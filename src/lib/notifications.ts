import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import type {
  NotificationChannel,
  NotificationDeliveryStatus,
  NotificationType,
  Prisma,
} from "@/generated/prisma/client";
import { sendMessagingMessage } from "@/lib/messaging/send";
import { getMessagingKind } from "@/lib/messaging/config";
import { parsePhoneNumber } from "@/lib/phone";

export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendNotificationParams {
  tenantId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
  attachments?: EmailAttachment[];
  /** Zusaetzlich In-App-Benachrichtigungen fuer diese Nutzer anlegen. */
  inAppUserIds?: string[];
  /** Titel/Link fuer die In-App-Benachrichtigung (Fallback: subject). */
  inAppTitle?: string;
  inAppLink?: string;
}

export type DeliverNotificationResult = {
  sent: boolean;
  status: NotificationDeliveryStatus;
  errorMessage: string | null;
  retryable: boolean;
};

/** Ersetzt {{platzhalter}} (case-insensitive) im Vorlagentext. */
export function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? "");
}

interface CreateInAppParams {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string | null;
}

/** Legt eine In-App-Benachrichtigung fuer einen Nutzer an (Glocke / Center). */
export async function createInAppNotification(params: CreateInAppParams) {
  return prisma.notification.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body,
      link: params.link ?? null,
    },
  });
}

export async function sendNotification(params: SendNotificationParams): Promise<boolean> {
  const result = await deliverNotification(params);
  return result.sent;
}

export async function deliverNotification(
  params: SendNotificationParams
): Promise<DeliverNotificationResult> {
  const { tenantId, type, channel, recipient, subject, body, metadata, attachments } =
    params;

  let result: DeliverNotificationResult = {
    sent: false,
    status: "FAILED",
    errorMessage: null,
    retryable: true,
  };

  if (channel === "EMAIL") {
    const email = await sendEmail(recipient, subject ?? "JoMaster", body, attachments);
    result = {
      sent: email.ok,
      status: email.ok ? "SENT" : "FAILED",
      errorMessage: email.ok ? null : email.error ?? "E-Mail-Versand fehlgeschlagen.",
      retryable: !email.ok,
    };
  } else if (channel === "SMS" || channel === "WHATSAPP") {
    const parsed = parsePhoneNumber(recipient);
    if (!parsed.ok || !parsed.e164) {
      result = {
        sent: false,
        status: "INVALID_PHONE",
        errorMessage: parsed.ok ? "Keine gültige Telefonnummer." : parsed.error,
        retryable: false,
      };
    } else {
      const sms = await sendMessagingMessage({
        toE164: parsed.e164,
        body,
        kind: channel === "WHATSAPP" ? "WHATSAPP" : getMessagingKind("SMS"),
      });
      result = {
        sent: sms.ok,
        status: sms.ok ? "SENT" : "FAILED",
        errorMessage: sms.ok ? null : sms.error ?? "Nachrichtenversand fehlgeschlagen.",
        retryable: sms.ok ? false : sms.retryable,
      };
    }
  } else {
    result = {
      sent: true,
      status: "SENT",
      errorMessage: null,
      retryable: false,
    };
  }

  await prisma.notificationLog.create({
    data: {
      tenantId,
      type,
      channel,
      recipient,
      subject,
      body,
      status: result.status,
      errorMessage: result.errorMessage,
      retryable: result.retryable,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  }).catch((err) => {
    console.error("[notifications] Protokoll konnte nicht geschrieben werden", err);
  });

  if (params.inAppUserIds?.length) {
    await prisma.notification.createMany({
      data: params.inAppUserIds.map((userId) => ({
        tenantId,
        userId,
        type,
        title: params.inAppTitle ?? subject ?? "Benachrichtigung",
        body,
        link: params.inAppLink ?? null,
      })),
    });
  }

  return result;
}

export async function recordNotificationSkip(params: {
  tenantId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  status: NotificationDeliveryStatus;
  errorMessage: string;
  metadata?: Record<string, unknown>;
  retryable?: boolean;
}) {
  await prisma.notificationLog.create({
    data: {
      tenantId: params.tenantId,
      type: params.type,
      channel: params.channel,
      recipient: params.recipient,
      subject: params.subject,
      body: params.body,
      status: params.status,
      errorMessage: params.errorMessage,
      retryable: params.retryable ?? false,
      metadata: (params.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
  });
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  attachments?: EmailAttachment[]
): Promise<{ ok: boolean; error?: string }> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[EMAIL DEV] To: ${to}, Subject: ${subject}` +
          (attachments?.length ? ` (+${attachments.length} Anhang)` : "") +
          `\n${body}`
      );
      return { ok: true };
    }
    return { ok: false, error: "E-Mail-Versand nicht konfiguriert (SMTP_HOST fehlt)." };
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@jomaster.app",
      to,
      subject,
      text: body,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return { ok: true };
  } catch (error) {
    console.error("E-Mail-Versand fehlgeschlagen:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "E-Mail-Versand fehlgeschlagen.",
    };
  }
}

/** @deprecated Nutze sendBookingConfirmationForOrder aus customer-email-notifications */
export async function notifyBookingConfirmation(
  tenantId: string,
  email: string,
  orderNumber: string,
  appointmentDate: string
) {
  return sendNotification({
    tenantId,
    type: "BUCHUNGSBESTAETIGUNG",
    channel: "EMAIL",
    recipient: email,
    subject: `Buchungsbestätigung ${orderNumber}`,
    body: `Ihre Buchung wurde bestätigt.\n\nAuftragsnummer: ${orderNumber}\nTermin: ${appointmentDate}\n\nVielen Dank für Ihr Vertrauen!`,
    metadata: { orderNumber },
  });
}

export async function notifyStatusChange(
  tenantId: string,
  email: string,
  orderNumber: string,
  newStatus: string
) {
  return sendNotification({
    tenantId,
    type: "STATUSAENDERUNG",
    channel: "EMAIL",
    recipient: email,
    subject: `Statusupdate ${orderNumber}`,
    body: `Der Status Ihres Auftrags ${orderNumber} wurde aktualisiert: ${newStatus}`,
    metadata: { orderNumber, newStatus },
  });
}

export async function notifyInvitation(
  tenantId: string,
  email: string,
  companyName: string,
  acceptUrl: string,
  personalMessage?: string | null
) {
  return sendNotification({
    tenantId,
    type: "EINLADUNG",
    channel: "EMAIL",
    recipient: email,
    subject: `Einladung von ${companyName}`,
    body:
      `Sie wurden von ${companyName} eingeladen.\n\n` +
      (personalMessage ? `Nachricht: ${personalMessage}\n\n` : "") +
      `Einladung annehmen und Zugang einrichten:\n${acceptUrl}\n\n` +
      `Der Link ist zeitlich begrenzt gültig.`,
    metadata: { acceptUrl },
  });
}

export async function notifyOrderShared(
  tenantId: string,
  email: string,
  companyName: string,
  orderNumber: string,
  note?: string | null
) {
  return sendNotification({
    tenantId,
    type: "FREIGABE",
    channel: "EMAIL",
    recipient: email,
    subject: `Eine Anfrage wurde mit Ihnen geteilt (${orderNumber})`,
    body:
      `${companyName} hat die Anfrage ${orderNumber} mit Ihnen geteilt.\n\n` +
      (note ? `Hinweis: ${note}\n\n` : "") +
      `Melden Sie sich in Ihrem Portal an, um die Details zu sehen.`,
    metadata: { orderNumber },
  });
}

export async function notifyNewMessage(
  tenantId: string,
  email: string,
  senderName: string,
  subject?: string | null
) {
  return sendNotification({
    tenantId,
    type: "NACHRICHT",
    channel: "EMAIL",
    recipient: email,
    subject: `Neue Nachricht von ${senderName}`,
    body:
      `Sie haben eine neue Nachricht von ${senderName} erhalten.\n\n` +
      (subject ? `Betreff: ${subject}\n\n` : "") +
      `Melden Sie sich an, um die Nachricht zu lesen.`,
    metadata: {},
  });
}

export async function notifyAppointmentReminder(
  tenantId: string,
  email: string,
  orderNumber: string,
  appointmentDate: string
) {
  return sendNotification({
    tenantId,
    type: "TERMINERINNERUNG",
    channel: "EMAIL",
    recipient: email,
    subject: `Terminerinnerung ${orderNumber}`,
    body: `Erinnerung: Ihr Termin ist am ${appointmentDate}.\n\nAuftragsnummer: ${orderNumber}`,
    metadata: { orderNumber },
  });
}
