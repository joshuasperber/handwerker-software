import { isValidE164 } from "@/lib/phone";
import {
  getMessagingStatus,
  getSevenCredentials,
  isMessagingDryRun,
  type MessagingKind,
} from "@/lib/messaging/config";

export type MessagingSendResult = {
  ok: boolean;
  error?: string;
  retryable: boolean;
  dryRun?: boolean;
  provider: "seven" | "none";
};

const SEVEN_STATUS: Record<string, string> = {
  "100": "SMS angenommen",
  "101": "Versand an mindestens einen Empfänger fehlgeschlagen.",
  "201": "Absender ungültig (max. 11 Zeichen).",
  "202": "Empfängernummer ungültig.",
  "301": "Empfänger fehlt.",
  "305": "Nachrichtentext ungültig.",
  "401": "Nachrichtentext zu lang.",
  "402": "Dieselbe SMS wurde in den letzten 180 Sekunden schon gesendet.",
  "403": "Tageslimit für diese Empfängernummer erreicht.",
  "500": "seven.io-Guthaben reicht nicht.",
  "600": "Fehler beim Versand über seven.io.",
  "900": "seven.io-API-Schlüssel ungültig.",
  "902": "API-Schlüssel hat keinen Zugriff auf SMS.",
  "903": "Ihre Server-IP ist bei seven.io nicht freigegeben.",
};

function sevenErrorMessage(code: string | undefined, fallback: string): string {
  if (!code) return fallback;
  return SEVEN_STATUS[code] ?? fallback;
}

/**
 * Versand über seven.io. Nur serverseitig aufrufen — keine Secrets nach außen.
 */
export async function sendMessagingMessage(params: {
  toE164: string;
  body: string;
  kind: MessagingKind;
}): Promise<MessagingSendResult> {
  if (!isValidE164(params.toE164)) {
    return {
      ok: false,
      error: "Ungültige Telefonnummer. Versand abgebrochen.",
      retryable: false,
      provider: "none",
    };
  }

  if (params.kind === "WHATSAPP") {
    return {
      ok: false,
      error: "WhatsApp ist mit seven.io nicht eingerichtet. Bitte SMS wählen.",
      retryable: false,
      provider: "seven",
    };
  }

  const status = getMessagingStatus("SMS");
  if (isMessagingDryRun()) {
    console.info(`[MESSAGING DRY-RUN] SMS → ${params.toE164}\n${params.body}`);
    return { ok: true, dryRun: true, retryable: false, provider: status.provider };
  }

  if (!status.configured) {
    return {
      ok: false,
      error: `Nachrichtenversand nicht konfiguriert. Es fehlen: ${status.missing.join(", ") || "Anbieterwerte"}.`,
      retryable: true,
      provider: status.provider,
    };
  }

  const creds = getSevenCredentials();
  if (!creds) {
    return {
      ok: false,
      error: "seven.io-Zugangsdaten fehlen (SEVEN_API_KEY).",
      retryable: true,
      provider: "none",
    };
  }

  const form = new URLSearchParams();
  form.set("to", params.toE164);
  form.set("text", params.body);
  form.set("from", creds.from);

  try {
    const response = await fetch("https://gateway.seven.io/api/sms", {
      method: "POST",
      headers: {
        "X-Api-Key": creds.apiKey,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
    });

    const payload = (await response.json().catch(() => null)) as {
      success?: string | boolean;
      messages?: { success?: boolean; error?: string | number | null; error_text?: string | null }[];
    } | null;

    const code = payload?.success != null ? String(payload.success) : undefined;
    const first = payload?.messages?.[0];
    const accepted = code === "100" || first?.success === true;

    if (response.ok && accepted) {
      return { ok: true, retryable: false, provider: "seven" };
    }

    const detail =
      first?.error_text ||
      sevenErrorMessage(code, `seven.io antwortete mit Status ${response.status}.`);
    return {
      ok: false,
      error: detail,
      retryable: response.status >= 500 || response.status === 429 || code === "500" || code === "600",
      provider: "seven",
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Verbindung zu seven.io fehlgeschlagen.",
      retryable: true,
      provider: "seven",
    };
  }
}
