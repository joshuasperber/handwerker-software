/** E.164: + plus 7–15 Ziffern, erste Ziffer 1–9. */
const E164 = /^\+[1-9]\d{6,14}$/;

export type PhoneParseResult =
  | { ok: true; e164: string | null }
  | { ok: false; error: string };

/**
 * Normalisiert eine Telefonnummer nach E.164.
 * Deutsche Nummern ohne Ländervorwahl (0176… / 030…) werden nach +49 gewandelt.
 */
export function parsePhoneNumber(
  input: string | null | undefined,
  defaultCountry: "DE" = "DE"
): PhoneParseResult {
  const raw = (input ?? "").trim();
  if (!raw) return { ok: true, e164: null };

  let value = raw.replace(/[^\d+]/g, "");
  if (!value) {
    return { ok: false, error: PHONE_INVALID_MESSAGE };
  }

  if (value.startsWith("00")) {
    value = `+${value.slice(2)}`;
  }

  if (!value.startsWith("+")) {
    if (value.startsWith("49") && value.length >= 12) {
      value = `+${value}`;
    } else if (defaultCountry !== "DE") {
      return {
        ok: false,
        error: "Bitte die Nummer international angeben, z. B. +4917612345678.",
      };
    } else {
      const national = value.replace(/^0+/, "");
      if (!national) return { ok: false, error: PHONE_INVALID_MESSAGE };
      value = `+49${national}`;
    }
  }

  // +490176… → +49176… (überzählige 0 nach der Ländervorwahl)
  if (value.startsWith("+490")) {
    value = `+49${value.slice(4)}`;
  }

  if (!E164.test(value)) {
    return { ok: false, error: PHONE_INVALID_MESSAGE };
  }

  return { ok: true, e164: value };
}

export const PHONE_INVALID_MESSAGE =
  "Ungültige Telefonnummer. Bitte im internationalen Format angeben, z. B. +4917612345678.";

export function isValidE164(value: string | null | undefined): boolean {
  return Boolean(value && E164.test(value));
}

export function requireE164(input: string | null | undefined): PhoneParseResult {
  const parsed = parsePhoneNumber(input);
  if (!parsed.ok) return parsed;
  if (!parsed.e164) {
    return { ok: false, error: "Bitte eine Telefonnummer angeben." };
  }
  return parsed;
}
