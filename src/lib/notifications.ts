import { prisma } from "./prisma";
import type { NotificationChannel, NotificationType, Prisma } from "@/generated/prisma/client";

interface SendNotificationParams {
  tenantId: string;
  type: NotificationType;
  channel: NotificationChannel;
  recipient: string;
  subject?: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export async function sendNotification(params: SendNotificationParams) {
  const { tenantId, type, channel, recipient, subject, body, metadata } =
    params;

  let sent = false;

  if (channel === "EMAIL") {
    sent = await sendEmail(recipient, subject ?? "Handwerker App", body);
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

  return sent;
}

async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  const host = process.env.SMTP_HOST;
  if (!host) {
    console.log(`[EMAIL DEV] To: ${to}, Subject: ${subject}\n${body}`);
    return true;
  }

  console.log(`[EMAIL] SMTP configured but nodemailer optional – To: ${to}, Subject: ${subject}`);
  return true;
}

async function sendSms(to: string, body: string): Promise<boolean> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  if (!sid) {
    console.log(`[SMS DEV] To: ${to}\n${body}`);
    return true;
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
