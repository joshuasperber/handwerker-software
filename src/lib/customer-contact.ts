import { parsePhoneNumber, type PhoneParseResult } from "@/lib/phone";
import type { CustomerContactPreference } from "@/generated/prisma/client";

const PREFERENCES: CustomerContactPreference[] = ["AUTO", "EMAIL", "SMS", "PHONE"];

export function parseStoredPhone(value: unknown): PhoneParseResult {
  if (value === undefined) return { ok: true, e164: null };
  if (value === null || value === "") return { ok: true, e164: null };
  if (typeof value !== "string") {
    return { ok: false, error: "Ungültige Telefonnummer." };
  }
  return parsePhoneNumber(value);
}

export function parseContactPreference(value: unknown): CustomerContactPreference | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "string" && PREFERENCES.includes(value as CustomerContactPreference)) {
    return value as CustomerContactPreference;
  }
  return undefined;
}

export function parseBooleanFlag(value: unknown, fallback?: boolean): boolean | undefined {
  if (value === undefined) return fallback;
  if (typeof value === "boolean") return value;
  return fallback;
}
