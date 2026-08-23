import { toStoredImageSrc } from "@/lib/stored-image";

export const INVOICE_LOGO_API = "/api/company-settings/logo";
export const TENANT_LOGO_API = "/api/tenant/settings/logo";

export function toInvoiceLogoSrc(
  stored: string | null | undefined,
  cacheKey?: string | number | Date | null
): string | null {
  return toStoredImageSrc(stored, INVOICE_LOGO_API, cacheKey);
}

export function toTenantLogoSrc(
  stored: string | null | undefined,
  cacheKey?: string | number | Date | null
): string | null {
  return toStoredImageSrc(stored, TENANT_LOGO_API, cacheKey);
}

/** Relativen Proxy-Src für iframes (srcDoc) gegen den Seiten-Origin auflösen. */
export function toAbsoluteLogoSrc(src: string | null | undefined, origin?: string): string | null {
  if (!src) return null;
  if (src.startsWith("data:") || /^https?:\/\//i.test(src)) return src;
  if (src.startsWith("/") && origin) return `${origin}${src}`;
  return src;
}
