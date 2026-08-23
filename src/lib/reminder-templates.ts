const BERLIN = "Europe/Berlin";

export const DEFAULT_REMINDER_EMAIL_TEMPLATE =
  "Guten Tag {{kundenname}}, wir erinnern Sie an Ihren Termin am {{datum}} um {{uhrzeit}}. Ihr Betrieb: {{betriebsname}}.";

export const DEFAULT_REMINDER_SMS_TEMPLATE =
  "Erinnerung: Ihr Termin mit {{betriebsname}} ist am {{datum}} um {{uhrzeit}}.";

export type ReminderTemplateVars = {
  kundenname: string;
  betriebsname: string;
  datum: string;
  uhrzeit: string;
  adresse: string;
  auftrag: string;
  auftragsnummer: string;
  kunde: string;
  ort: string;
};

export function buildReminderVars(input: {
  startTime: Date;
  customerName: string;
  companyName: string;
  orderNumber: string;
  address?: string | null;
  city?: string | null;
}): ReminderTemplateVars {
  const datum = input.startTime.toLocaleDateString("de-DE", {
    timeZone: BERLIN,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const uhrzeit = input.startTime.toLocaleTimeString("de-DE", {
    timeZone: BERLIN,
    hour: "2-digit",
    minute: "2-digit",
  });
  const name = input.customerName.trim();
  return {
    kundenname: name,
    kunde: name,
    betriebsname: input.companyName,
    datum,
    uhrzeit,
    adresse: (input.address ?? "").trim(),
    auftrag: input.orderNumber,
    auftragsnummer: input.orderNumber,
    ort: (input.city ?? "").trim(),
  };
}

export function renderReminderEmail(template: string | null | undefined, vars: ReminderTemplateVars): string {
  const source = template?.trim() || DEFAULT_REMINDER_EMAIL_TEMPLATE;
  return applyReminderTemplate(source, vars);
}

export function renderReminderSms(template: string | null | undefined, vars: ReminderTemplateVars): string {
  const source = template?.trim() || DEFAULT_REMINDER_SMS_TEMPLATE;
  return applyReminderTemplate(source, vars);
}

function applyReminderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? "");
}
