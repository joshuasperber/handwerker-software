import nodemailer from "nodemailer";
import { prisma } from "./prisma";
import type { NotificationChannel, NotificationType, Prisma } from "@/generated/prisma/client";

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

export async function sendNotification(params: SendNotificationParams) {
  const { tenantId, type, channel, recipient, subject, body, metadata, attachments } =
    params;

  let sent = false;

  if (channel === "EMAIL") {
    sent = await sendEmail(recipient, subject ?? "Handwerker App", body, attachments);
  } else if (channel === "SMS") {
    sent = await sendSms(recipient, body);
  }

  await prisma.notificationLog.create({
    data: {
      tenantId,
      type,
      channel,
      recipient,
      subject,
      body,
      metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
    },
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

  return sent;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string,
  attachments?: EmailAttachment[]
): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[EMAIL DEV] To: ${to}, Subject: ${subject}` +
          (attachments?.length ? ` (+${attachments.length} Anhang)` : "") +
          `\n${body}`
      );
    }
    return false;
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
      from: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "no-reply@handwerker.app",
      to,
      subject,
      text: body,
      attachments: attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      })),
    });
    return true;
  } catch (error) {
    console.error("E-Mail-Versand fehlgeschlagen:", error);
    return false;
  }
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) {
    if (process.env.NODE_ENV === "development") {
      console.log(`[SMS DEV] To: ${to}\n${body}`);
    }
    return false;
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: to,
          From: process.env.TWILIO_FROM_NUMBER ?? "",
          Body: body,
        }),
      }
    );
    return response.ok;
  } catch (error) {
    console.error("SMS send failed:", error);
    return false;
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
