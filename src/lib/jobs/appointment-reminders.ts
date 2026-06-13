import { prisma } from "@/lib/prisma";
import { sendNotification, createInAppNotification, applyTemplate } from "@/lib/notifications";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { formatDateTime } from "@/lib/utils";
import { emptyReport, type JobReport } from "./types";

/**
 * Versendet Terminerinnerungen fuer Termine im Vorlauffenster.
 * Idempotent ueber Appointment.reminderSentAt (kein Doppelversand).
 */
export async function runAppointmentReminders(
  tenantId: string,
  now = new Date()
): Promise<JobReport> {
  const report = emptyReport("appointment-reminders");
  const settings = await getOrCreateNotificationSettings(tenantId);
  if (!settings.appointmentReminderEnabled) {
    report.details?.push("deaktiviert");
    return report;
  }

  const windowEnd = new Date(now.getTime() + settings.appointmentReminderHoursBefore * 3600_000);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId,
      status: "GEPLANT",
      reminderSentAt: null,
      startTime: { gte: now, lte: windowEnd },
      order: { customerConfirmationStatus: "BESTAETIGT" },
    },
    include: {
      order: { include: { customer: true, property: true } },
      employee: { select: { userId: true } },
    },
  });

  for (const appt of appointments) {
    try {
      const when = formatDateTime(appt.startTime);
      const orderNumber = appt.order.orderNumber;
      const city = appt.order.property?.city ?? "";
      const customerName = `${appt.order.customer.firstName} ${appt.order.customer.lastName}`.trim();

      if (settings.remindCustomer && settings.defaultEmail && appt.order.customer.email) {
        const defaultBody = `Erinnerung an Ihren Termin am ${when}${city ? ` in ${city}` : ""}.\n\nAuftragsnummer: ${orderNumber}`;
        const body = settings.reminderEmailTemplate
          ? applyTemplate(settings.reminderEmailTemplate, {
              kunde: customerName,
              datum: when,
              auftragsnummer: orderNumber,
              ort: city,
            })
          : defaultBody;
        await sendNotification({
          tenantId,
          type: "TERMINERINNERUNG",
          channel: "EMAIL",
          recipient: appt.order.customer.email,
          subject: `Terminerinnerung ${orderNumber}`,
          body,
          metadata: { appointmentId: appt.id },
        });
      }

      if (settings.remindEmployee && appt.employee?.userId) {
        await createInAppNotification({
          tenantId,
          userId: appt.employee.userId,
          type: "TERMINERINNERUNG",
          title: `Termin am ${when}`,
          body: `${orderNumber}${city ? ` · ${city}` : ""}`,
          link: `/monteur/auftrag/${appt.orderId}`,
        });
      }

      await prisma.appointment.update({
        where: { id: appt.id },
        data: { reminderSentAt: new Date() },
      });
      report.processed++;
    } catch (err) {
      report.errors++;
      report.details?.push(`Termin ${appt.id}: ${err instanceof Error ? err.message : "Fehler"}`);
    }
  }

  return report;
}
