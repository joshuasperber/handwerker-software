import { prisma } from "./prisma";
import { getOrCreateNotificationSettings } from "./notification-settings";
import { sendNotification, applyTemplate } from "./notifications";
import { formatDateTime } from "./utils";

export type CustomerEmailRecipient = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  bookingConfirmationEmailTemplate?: string | null;
};

export function customerDisplayName(
  customer: Pick<CustomerEmailRecipient, "firstName" | "lastName">
): string {
  return `${customer.firstName} ${customer.lastName}`.trim();
}

function buildBookingConfirmationBody(
  template: string | null | undefined,
  vars: Record<string, string>
): string {
  const defaultBody =
    `Ihre Buchung wurde bestätigt.\n\nAuftragsnummer: ${vars.auftragsnummer}\nTermin: ${vars.datum}` +
    (vars.ort ? `\nOrt: ${vars.ort}` : "") +
    `\n\nVielen Dank für Ihr Vertrauen!`;
  if (!template?.trim()) return defaultBody;
  return applyTemplate(template, vars);
}

/** Versendet Buchungsbestätigung an die E-Mail aus dem Kundenprofil (einmal pro Auftrag). */
export async function sendBookingConfirmationForOrder(params: {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  customer: CustomerEmailRecipient;
  appointmentStart: Date;
  city?: string | null;
}): Promise<boolean> {
  const settings = await getOrCreateNotificationSettings(params.tenantId);
  if (!settings.bookingConfirmationEnabled || !settings.defaultEmail) return false;
  if (!params.customer.email?.trim()) return false;

  const order = await prisma.order.findFirst({
    where: { id: params.orderId, tenantId: params.tenantId },
    select: { bookingConfirmationSentAt: true },
  });
  if (!order || order.bookingConfirmationSentAt) return false;

  const when = formatDateTime(params.appointmentStart);
  const template =
    params.customer.bookingConfirmationEmailTemplate ??
    settings.bookingConfirmationEmailTemplate;

  const body = buildBookingConfirmationBody(template, {
    kunde: customerDisplayName(params.customer),
    datum: when,
    auftragsnummer: params.orderNumber,
    ort: params.city ?? "",
  });

  const sent = await sendNotification({
    tenantId: params.tenantId,
    type: "BUCHUNGSBESTAETIGUNG",
    channel: "EMAIL",
    recipient: params.customer.email,
    subject: `Buchungsbestätigung ${params.orderNumber}`,
    body,
    metadata: { orderNumber: params.orderNumber, orderId: params.orderId },
  });

  await prisma.order.update({
    where: { id: params.orderId },
    data: { bookingConfirmationSentAt: new Date() },
  });

  return sent;
}

/** Buchungsbestätigung, falls Auftrag noch keinen Versand hatte und ein Termin existiert. */
export async function maybeSendBookingConfirmationForOrder(
  tenantId: string,
  orderId: string
): Promise<boolean> {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId, bookingConfirmationSentAt: null },
    include: {
      customer: true,
      property: true,
      appointments: { take: 1, orderBy: { startTime: "asc" } },
    },
  });
  if (!order?.appointments[0]) return false;

  return sendBookingConfirmationForOrder({
    tenantId,
    orderId: order.id,
    orderNumber: order.orderNumber,
    customer: order.customer,
    appointmentStart: order.appointments[0].startTime,
    city: order.property?.city,
  });
}
