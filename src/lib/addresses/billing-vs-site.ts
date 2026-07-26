/** Hilfen zur Trennung von Rechnungs- und Ausführungsadresse. */

export type BillingLike = {
  billingStreet?: string | null;
  billingZipCode?: string | null;
  billingCity?: string | null;
};

export type SiteLike = {
  street?: string | null;
  zipCode?: string | null;
  city?: string | null;
  label?: string | null;
};

export function hasBillingAddress(c: BillingLike | null | undefined): boolean {
  return Boolean(c?.billingStreet?.trim() && c?.billingZipCode?.trim() && c?.billingCity?.trim());
}

export function formatBillingAddressLines(c: BillingLike | null | undefined): string[] {
  if (!hasBillingAddress(c) || !c) return [];
  return [`${c.billingStreet!.trim()}`, `${c.billingZipCode!.trim()} ${c.billingCity!.trim()}`];
}

export function formatBillingAddressOneLine(c: BillingLike | null | undefined): string {
  return formatBillingAddressLines(c).join(", ");
}

export function formatSiteAddressLines(p: SiteLike | null | undefined): string[] {
  if (!p?.street?.trim() || !p.zipCode?.trim() || !p.city?.trim()) return [];
  return [`${p.street.trim()}`, `${p.zipCode.trim()} ${p.city.trim()}`];
}

export function formatSiteAddressOneLine(p: SiteLike | null | undefined): string {
  return formatSiteAddressLines(p).join(", ");
}

/** True, wenn Ausführungsadresse inhaltlich von der Rechnungsadresse abweicht. */
export function siteDiffersFromBilling(
  billing: BillingLike | null | undefined,
  site: SiteLike | null | undefined
): boolean {
  if (!hasBillingAddress(billing) || !site?.street) return Boolean(site?.street);
  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  return (
    norm(billing!.billingStreet!) !== norm(site.street!) ||
    norm(billing!.billingZipCode!) !== norm(site.zipCode ?? "") ||
    norm(billing!.billingCity!) !== norm(site.city ?? "")
  );
}

export function propertyMatchesBilling(
  property: SiteLike,
  billing: BillingLike
): boolean {
  if (!hasBillingAddress(billing)) return false;
  return !siteDiffersFromBilling(billing, property);
}
