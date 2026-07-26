import type { StockMovementType } from "@/generated/prisma/client";

export const WITHDRAWAL_REASONS = [
  { value: "AUFTRAG", label: "Verbrauch für Auftrag", movementType: "VERBRAUCH" as StockMovementType },
  { value: "VERKAUF", label: "Verkauf", movementType: "ABGANG" as StockMovementType },
  { value: "WEITERGABE", label: "Weitergabe", movementType: "ABGANG" as StockMovementType },
  { value: "EIGENVERBRAUCH", label: "Eigenverbrauch", movementType: "ABGANG" as StockMovementType },
  { value: "BESCHAEDIGT", label: "beschädigt", movementType: "ABGANG" as StockMovementType },
  { value: "VERLOREN", label: "verloren", movementType: "ABGANG" as StockMovementType },
  { value: "KORREKTUR", label: "Korrektur", movementType: "ABGANG" as StockMovementType },
  { value: "SONSTIGES", label: "sonstiger Grund", movementType: "ABGANG" as StockMovementType },
] as const;

export type WithdrawalReason = (typeof WITHDRAWAL_REASONS)[number]["value"];

export const REPLENISH_REASON = "EINKAUF";

export const REASON_LABELS: Record<string, string> = {
  AUFTRAG: "Verbrauch für Auftrag",
  VERKAUF: "Verkauf",
  WEITERGABE: "Weitergabe",
  EIGENVERBRAUCH: "Eigenverbrauch",
  BESCHAEDIGT: "beschädigt",
  VERLOREN: "verloren",
  KORREKTUR: "Korrektur",
  SONSTIGES: "sonstiger Grund",
  EINKAUF: "Einkauf / Auffüllen",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  ZUGANG: "Zugang",
  ABGANG: "Abgang",
  UMBUCHUNG: "Umbuchung",
  VERBRAUCH: "Verbrauch",
  RUECKGABE: "Rückgabe",
  KORREKTUR: "Korrektur",
};

export function withdrawalMovementType(reason: string): StockMovementType {
  const found = WITHDRAWAL_REASONS.find((r) => r.value === reason);
  return found?.movementType ?? "ABGANG";
}

export function isSaleLikeReason(reason: string | null | undefined): boolean {
  return reason === "VERKAUF" || reason === "WEITERGABE";
}

/** Dokumentierter Stückgewinn (keine steuerliche Bewertung). */
export function calcDocumentedUnitMargin(
  purchasePriceNet: number | null | undefined,
  salePriceNet: number | null | undefined
): number | null {
  if (purchasePriceNet == null || salePriceNet == null) return null;
  if (!Number.isFinite(purchasePriceNet) || !Number.isFinite(salePriceNet)) return null;
  return Math.round((salePriceNet - purchasePriceNet) * 100) / 100;
}
