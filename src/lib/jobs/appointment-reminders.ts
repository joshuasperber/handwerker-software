import { prisma } from "@/lib/prisma";
import {
  createInAppNotification,
  deliverNotification,
  recordNotificationSkip,
} from "@/lib/notifications";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { resolveReminderDelivery } from "@/lib/reminder-channel";
import { buildReminderVars, renderReminderEmail, renderReminderSms } from "@/lib/reminder-templates";
import { getMessagingStatus, getMessagingKind } from "@/lib/messaging/config";
import { emptyReport, type JobReport } from "./types";
import type { NotificationChannel, NotificationDeliveryStatus } from "@/generated/prisma/client";

function addressLine(property: { street?: string | null; zipCode?: string | null; city?: string | null } | null): string {
  if (!property) return "";
  return [property.street, [property.zipCode, property.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
}

async function alreadySent(tenantId: string, appointmentId: string): Promise<boolean> {
  const log = await prisma.notificationLog.findFirst({
    where: {
      tenantId,
      type: "TERMINERINNERUNG",
      status: "SENT",
      metadata: { path: ["appointmentId"], equals: appointmentId },
    },
    select: { id: true },
  });
  return Boolean(log);
}

async function lastSkip(
  tenantId: string,
  appointmentId: string
): Promise<{ status: NotificationDeliveryStatus; errorMessage: string | null } | null> {
  const log = await prisma.notificationLog.findFirst({
    where: {
      tenantId,
      type: "TERMINERINNERUNG",
      metadata: { path: ["appointmentId"], equals: appointmentId },
    },
    orderBy: { sentAt: "desc" },
    select: { status: true, errorMessage: true },
  });
  return log;
}

/**
 * Versendet Terminerinnerungen fuer Termine im Vorlauffenster (Standard: 24 Stunden).
 * Idempotent ueber Appointment.reminderSentAt und NotificationLog (kein Doppelversand).
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

  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { name: true },
  });
  const companyName = tenant?.name ?? "JoMaster";
  const messagingKind = getMessagingKind(settings.messagingMode);
  const messagingConfigured = getMessagingStatus(messagingKind).configured;

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
    if (!appt.order) continue;
    try {
      if (await alreadySent(tenantId, appt.id)) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data: { reminderSentAt: new Date(), reminderStatus: "ALREADY_SENT" },
        });
        report.skipped++;
        continue;
      }

      const customer = appt.order.customer;
      const vars = buildReminderVars({
        startTime: appt.startTime,
        customerName: `${customer.firstName} ${customer.lastName}`,
        companyName,
        orderNumber: appt.order.orderNumber,
        address: addressLine(appt.order.property),
        city: appt.order.property?.city,
      });

      const decision = resolveReminderDelivery(customer, settings, { messagingConfigured });
      let customerStatus: NotificationDeliveryStatus | null = null;
      let customerError: string | null = null;
      let customerChannel: NotificationChannel | null = null;

      if (decision.action === "skip") {
        const previous = await lastSkip(tenantId, appt.id);
        const sameSkip = previous?.status === decision.status && previous.errorMessage === decision.reason;
        if (!sameSkip) {
          await recordNotificationSkip({
            tenantId,
            type: "TERMINERINNERUNG",
            channel: decision.status === "INVALID_PHONE" ? "SMS" : "EMAIL",
            recipient: customer.email || customer.phone || "—",
            subject: `Terminerinnerung ${appt.order.orderNumber}`,
            body: decision.reason,
            status: decision.status,
            errorMessage: decision.reason,
            metadata: { appointmentId: appt.id, orderId: appt.orderId },
            retryable: decision.status === "NO_CONTACT" || decision.status === "INVALID_PHONE",
          });
        }
        customerStatus = decision.status;
        customerError = decision.reason;
        report.skipped++;
        report.details?.push(`${appt.order.orderNumber}: ${decision.reason}`);
      } else {
        const body =
          decision.channel === "EMAIL"
            ? renderReminderEmail(settings.reminderEmailTemplate, vars)
            : renderReminderSms(settings.reminderSmsTemplate, vars);
        const delivered = await deliverNotification({
          tenantId,
          type: "TERMINERINNERUNG",
          channel: decision.channel,
          recipient: decision.recipient,
          subject: `Terminerinnerung ${appt.order.orderNumber}`,
          body,
          metadata: { appointmentId: appt.id, orderId: appt.orderId, kind: decision.kind ?? null },
        });
        customerChannel = decision.channel;
        customerStatus = delivered.status;
        customerError = delivered.errorMessage;
        if (delivered.sent) {
          report.processed++;
        } else {
          report.errors++;
          report.details?.push(
            `Termin ${appt.id}: ${delivered.errorMessage ?? "Versand fehlgeschlagen"} (${decision.channel})`
          );
        }
      }

      if (settings.remindEmployee && appt.employee?.userId) {
        await createInAppNotification({
          tenantId,
          userId: appt.employee.userId,
          type: "TERMINERINNERUNG",
          title: `Termin am ${vars.datum} um ${vars.uhrzeit}`,
          body: `${appt.order.orderNumber}${vars.ort ? ` · ${vars.ort}` : ""}`,
          link: `/monteur/auftrag/${appt.orderId}`,
        });
      }

      const customerSent = customerStatus === "SENT";
      await prisma.appointment.update({
        where: { id: appt.id },
        data: {
          reminderSentAt: customerSent ? new Date() : null,
          reminderStatus: customerStatus,
          reminderError: customerError,
          reminderChannel: customerChannel,
        },
      });
    } catch (err) {
      report.errors++;
      report.details?.push(`Termin ${appt.id}: ${err instanceof Error ? err.message : "Fehler"}`);
    }
  }

  return report;
}
