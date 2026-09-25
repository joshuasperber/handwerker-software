/** Validierung: Name Pflicht, Preis darf nicht fehlen/0 sein (außer Formel-Zone). */
export function validateZonePayload(body: Record<string, unknown>): string | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return "Name der Zone ist erforderlich.";

  const useFormula = body.useFormula === true;
  if (!useFormula) {
    const fee = Number(body.flatFeeNet);
    if (!Number.isFinite(fee)) return "Preis der Zone ist erforderlich.";
    if (fee <= 0) return "Preis der Zone muss größer als 0 € sein.";
  }

  if (body.minKm != null && Number(body.minKm) < 0) {
    return "Mindest-km darf nicht negativ sein.";
  }
  if (
    body.maxKm != null &&
    body.maxKm !== "" &&
    Number(body.maxKm) < Number(body.minKm ?? 0)
  ) {
    return "Maximal-km muss größer als Mindest-km sein.";
  }

  return null;
}
