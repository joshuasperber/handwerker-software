import "dotenv/config";

/** Öffentliche, secret-freie Statuswerte für den Messaging-Anbieter. */

export type MessagingProviderId = "seven" | "none";
export type MessagingKind = "SMS" | "WHATSAPP";

export type ChannelStatus = {
  provider: MessagingProviderId;
  configured: boolean;
  missing: string[];
  fromMasked: string | null;
  messagingServiceMasked: string | null;
  whatsappFromMasked: string | null;
  dryRun: boolean;
  emptyDeclared: boolean;
};

function maskSecret(value: string | undefined | null, visible = 4): string | null {
  if (!value?.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.length <= visible) return "••••";
  return `••••${trimmed.slice(-visible)}`;
}

function readEnv(value: string | undefined): string {
  return (value ?? "").trim();
}

/** Absendername, max. 11 alphanumerische Zeichen (seven.io). */
export function getSevenFrom(): string {
  const raw = readEnv(process.env.SEVEN_SMS_FROM) || readEnv(process.env.SEVEN_FROM) || "JoMaster";
  const cleaned = raw.replace(/[^A-Za-z0-9]/g, "").slice(0, 11);
  return cleaned || "JoMaster";
}

export function getMessagingKind(settingsMode?: string | null): MessagingKind {
  return settingsMode === "WHATSAPP" ? "WHATSAPP" : "SMS";
}

export function isMessagingDryRun(): boolean {
  return readEnv(process.env.MESSAGING_DRY_RUN) === "true";
}

export function getSevenApiKey(): string {
  return readEnv(process.env.SEVEN_API_KEY);
}

/** Serverseitige seven.io-Konfiguration. Secrets werden nicht zurückgegeben. */
export function getMessagingStatus(kind: MessagingKind = "SMS"): ChannelStatus {
  void kind;
  const apiKey = getSevenApiKey();
  const from = getSevenFrom();
  const dryRun = isMessagingDryRun();

  const missing: string[] = [];
  if (!apiKey) missing.push("SEVEN_API_KEY");

  const configured = missing.length === 0 || dryRun;

  return {
    provider: apiKey ? "seven" : "none",
    configured,
    missing: dryRun ? [] : missing,
    fromMasked: maskSecret(from, 2),
    messagingServiceMasked: null,
    whatsappFromMasked: null,
    dryRun,
    emptyDeclared: !apiKey && process.env.SEVEN_API_KEY !== undefined,
  };
}

export function getEmailChannelStatus(): { configured: boolean; missing: string[]; fromMasked: string | null } {
  const host = readEnv(process.env.SMTP_HOST);
  const from = readEnv(process.env.SMTP_FROM) || readEnv(process.env.SMTP_USER);
  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  return {
    configured: Boolean(host) || process.env.NODE_ENV === "development",
    missing,
    fromMasked: maskSecret(from, 8),
  };
}

export function getSevenCredentials(): { apiKey: string; from: string } | null {
  const apiKey = getSevenApiKey();
  if (!apiKey) return null;
  return { apiKey, from: getSevenFrom() };
}
