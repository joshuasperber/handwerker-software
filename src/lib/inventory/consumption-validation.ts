export type ConsumptionLineInput = {
  lineId: string;
  quantityConsumed: number;
  returned?: number;
};

export function validateConsumptionLines(
  value: unknown
): { lines: ConsumptionLineInput[] } | { error: string } {
  if (!Array.isArray(value) || value.length === 0) {
    return { error: "Mindestens eine Materialposition ist erforderlich." };
  }

  const seen = new Set<string>();
  const lines: ConsumptionLineInput[] = [];

  for (const raw of value) {
    if (!raw || typeof raw !== "object") {
      return { error: "Ungültige Materialposition." };
    }
    const item = raw as Record<string, unknown>;
    const lineId = typeof item.lineId === "string" ? item.lineId.trim() : "";
    const quantityConsumed = Number(item.quantityConsumed ?? 0);
    const returned = Number(item.returned ?? 0);

    if (!lineId) return { error: "Materialposition fehlt." };
    if (seen.has(lineId)) {
      return { error: "Eine Materialposition darf nur einmal gebucht werden." };
    }
    if (!Number.isFinite(quantityConsumed) || quantityConsumed < 0) {
      return { error: "Verbrauch muss 0 oder größer sein." };
    }
    if (!Number.isFinite(returned) || returned < 0) {
      return { error: "Rückgabe muss 0 oder größer sein." };
    }
    if (quantityConsumed === 0 && returned === 0) {
      return { error: "Verbrauch oder Rückgabe muss größer als 0 sein." };
    }

    seen.add(lineId);
    lines.push({
      lineId,
      quantityConsumed,
      ...(returned > 0 ? { returned } : {}),
    });
  }

  return { lines };
}
