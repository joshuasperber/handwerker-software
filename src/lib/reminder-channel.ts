import type { CustomerContactPreference, NotificationChannel } from "@/generated/prisma/client";
import { parsePhoneNumber } from "@/lib/phone";
import { getMessagingKind, getMessagingStatus, type MessagingKind } from "@/lib/messaging/config";

export const PLACEHOLDER_EMAIL_SUFFIX = "@kunde.local";

export function isUsableEmail(email: string | null | undefined): boolean {
  const value = (email ?? "").trim().toLowerCase();
  if (!value || !value.includes("@")) return false;
  if (value.endsWith(PLACEHOLDER_EMAIL_SUFFIX)) return false;
  return true;
}

export type ReminderSkipStatus = "NO_CONTACT" | "INVALID_PHONE" | "DISABLED";

export type ReminderDeliveryDecision =
  | {
      action: "send";
      channel: Extract<NotificationChannel, "EMAIL" | "SMS" | "WHATSAPP">;
      recipient: string;
      kind?: MessagingKind;
    }
  | { action: "skip"; status: ReminderSkipStatus; reason: string };

export type ReminderCustomerInput = {
  email?: string | null;
  phone?: string | null;
  contactAllowed?: boolean | null;
  appointmentRemindersEnabled?: boolean | null;
  preferredContactChannel?: CustomerContactPreference | string | null;
};

export type ReminderSettingsInput = {
  appointmentReminderEnabled?: boolean | null;
  remindCustomer?: boolean | null;
  defaultEmail?: boolean | null;
  defaultSms?: boolean | null;
  messagingMode?: string | null;
};

/**
 * Wählt den Versandkanal für eine Terminerinnerung.
 * AUTO: nur E-Mail → E-Mail; nur Telefon → Nachricht; beides → Nachricht bevorzugt.
 */
export function resolveReminderDelivery(
  customer: ReminderCustomerInput,
  settings: ReminderSettingsInput,
  runtime?: { messagingConfigured?: boolean }
): ReminderDeliveryDecision {
  if (!settings.appointmentReminderEnabled) {
    return { action: "skip", status: "DISABLED", reason: "Terminerinnerungen sind deaktiviert." };
  }
  if (!settings.remindCustomer) {
    return { action: "skip", status: "DISABLED", reason: "Kunden-Erinnerungen sind deaktiviert." };
  }
  if (customer.contactAllowed === false) {
    return { action: "skip", status: "DISABLED", reason: "Kontakt für diesen Kunden ist nicht erlaubt." };
  }
  if (customer.appointmentRemindersEnabled === false) {
    return {
      action: "skip",
      status: "DISABLED",
      reason: "Terminerinnerungen sind für diesen Kunden deaktiviert.",
    };
  }

  const email = isUsableEmail(customer.email) ? customer.email!.trim() : null;
  const phoneParsed = parsePhoneNumber(customer.phone);
  const phone = phoneParsed.ok ? phoneParsed.e164 : null;
  const phoneInvalid = Boolean((customer.phone ?? "").trim()) && !phone;
  const preference = (customer.preferredContactChannel ?? "AUTO") as CustomerContactPreference;
  const messagingKind = getMessagingKind(settings.messagingMode);
  const messagingConfigured =
    runtime?.messagingConfigured ?? getMessagingStatus(messagingKind).configured;
  const smsEnabled = Boolean(settings.defaultSms) && messagingConfigured;
  const emailEnabled = Boolean(settings.defaultEmail);

  const messageChannel: "SMS" | "WHATSAPP" = messagingKind === "WHATSAPP" ? "WHATSAPP" : "SMS";

  function sendEmail(): ReminderDeliveryDecision {
    if (!email) {
      return { action: "skip", status: "NO_CONTACT", reason: "Keine Kontaktdaten vorhanden" };
    }
    if (!emailEnabled) {
      return { action: "skip", status: "DISABLED", reason: "E-Mail-Versand ist deaktiviert." };
    }
    return { action: "send", channel: "EMAIL", recipient: email };
  }

  function sendMessage(): ReminderDeliveryDecision {
    if (phoneInvalid) {
      return {
        action: "skip",
        status: "INVALID_PHONE",
        reason: phoneParsed.ok ? "Ungültige Telefonnummer" : phoneParsed.error,
      };
    }
    if (!phone) {
      return { action: "skip", status: "NO_CONTACT", reason: "Keine Kontaktdaten vorhanden" };
    }
    if (!smsEnabled) {
      if (email && emailEnabled) return sendEmail();
      return {
        action: "skip",
        status: "DISABLED",
        reason: messagingConfigured
          ? "SMS-/Nachrichtenversand ist deaktiviert."
          : "Nachrichtenversand nicht konfiguriert (SEVEN_API_KEY fehlt).",
      };
    }
    return { action: "send", channel: messageChannel, recipient: phone, kind: messagingKind };
  }

  if (preference === "EMAIL") return sendEmail();
  if (preference === "SMS" || preference === "PHONE") return sendMessage();

  // AUTO
  if (phoneInvalid && !email) {
    return {
      action: "skip",
      status: "INVALID_PHONE",
      reason: phoneParsed.ok ? "Ungültige Telefonnummer" : phoneParsed.error,
    };
  }
  if (phone && smsEnabled) return sendMessage();
  if (phone && !smsEnabled && !email) return sendMessage(); // ergibt DISABLED mit Hinweis
  if (email) return sendEmail();
  if (phone) return sendMessage();
  return { action: "skip", status: "NO_CONTACT", reason: "Keine Kontaktdaten vorhanden" };
}
