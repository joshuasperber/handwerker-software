/** Parst Betrags-Eingaben mit Komma oder Punkt. */
export function parseExpenseAmount(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = parseFloat(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Netto / MwSt / Brutto sinnvoll auflösen.
 * Fehlendes Netto wird aus Brutto − MwSt abgeleitet (und umgekehrt).
 */
export function resolveExpenseAmounts(
  netStr: string,
  vatStr: string,
  grossStr: string
): { net: number; vat: number; gross: number } | null {
  const vatParsed = parseExpenseAmount(vatStr);
  const vat = vatParsed != null && vatParsed >= 0 ? vatParsed : 0;
  let net = parseExpenseAmount(netStr);
  let gross = parseExpenseAmount(grossStr);

  if (net == null && gross != null) {
    net = Math.max(0, +(gross - vat).toFixed(2));
  }
  if (gross == null && net != null) {
    gross = +(net + vat).toFixed(2);
  }
  if (net == null || gross == null || net < 0 || gross < 0 || vat < 0) {
    return null;
  }
  return { net, vat, gross };
}
