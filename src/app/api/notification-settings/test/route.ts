import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { deliverNotification } from "@/lib/notifications";
import { requireE164 } from "@/lib/phone";
import { isUsableEmail } from "@/lib/reminder-channel";
import {
  DEFAULT_REMINDER_EMAIL_TEMPLATE,
  buildReminderVars,
  renderReminderEmail,
  renderReminderSms,
} from "@/lib/reminder-templates";

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "Unbekannter Serverfehler";
}

const schema = z.object({
  channel: z.enum(["EMAIL", "SMS", "WHATSAPP"]),
  phone: z.string().optional(),
  email: z.string().optional(),
  template: z.enum(["reminder", "booking"]).optional(),
});

export async function POST(request: Request) {
  const auth = await requireAuth("notifications.manage");
  if (auth instanceof Response) return auth;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", 400);
  }

  try {
    const settings = await getOrCreateNotificationSettings(auth.tenantId).catch(() => null);
    const tenant = await prisma.tenant.findFirst({
      where: { id: auth.tenantId },
      select: { name: true },
    });
    const vars = buildReminderVars({
      startTime: new Date(Date.now() + 24 * 3600_000),
      customerName: "Testkunde",
      companyName: tenant?.name ?? "JoMaster",
      orderNumber: "TEST-001",
      address: "Musterstraße 1, 12345 Musterstadt",
      city: "Musterstadt",
    });

    const channel = parsed.data.channel;
    let recipient = "";
    let body = "";
    let subject = "Testnachricht JoMaster";

    if (channel === "EMAIL") {
      const email = (parsed.data.email ?? "").trim();
      if (!isUsableEmail(email)) {
        return apiError("Bitte eine gültige Test-E-Mail angeben.", 400);
      }
      recipient = email;
      body = renderReminderEmail(
        parsed.data.template === "booking" ? settings?.bookingConfirmationEmailTemplate : settings?.reminderEmailTemplate,
        vars
      );
      subject = "Test: Terminerinnerung";
    } else {
      const phone = requireE164(parsed.data.phone);
      if (!phone.ok || !phone.e164) {
        return apiError(phone.ok ? "Bitte eine Test-Telefonnummer angeben." : phone.error, 400);
      }
      recipient = phone.e164;
      body = renderReminderSms(settings?.reminderSmsTemplate ?? null, vars);
    }

    const result = await deliverNotification({
      tenantId: auth.tenantId,
      type: "SYSTEM",
      channel,
      recipient,
      subject,
      body: body || DEFAULT_REMINDER_EMAIL_TEMPLATE,
      metadata: { test: true, requestedBy: auth.id },
    });

    if (settings) {
      await prisma.notificationSettings.update({
        where: { tenantId: auth.tenantId },
        data: {
          messagingLastTestAt: new Date(),
          messagingLastTestStatus: result.status,
          messagingLastTestError: result.errorMessage,
          messagingLastTestChannel: channel,
        },
      }).catch(() => undefined);
    }

    return apiSuccess({
      sent: result.sent,
      status: result.status,
      channel,
      recipient,
      error: result.errorMessage,
      retryable: result.retryable,
    });
  } catch (err) {
    return apiError(errorMessage(err), 500);
  }
}
