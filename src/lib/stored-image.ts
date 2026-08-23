/**
 * Gemeinsame Bild-Speicherformate (Logo, Avatar):
 * - `data:image/...;base64,...` — Fallback ohne S3, inline in der DB
 * - `https://...` / `http://...` — öffentliche URL
 * - `/api/...` — Anzeige-Proxy, nie zurück in die DB schreiben
 * - sonst — S3-Storage-Key
 */

export function hasStoredImage(value: string | null | undefined): boolean {
  return Boolean(value && value.trim());
}

export function isDataImage(value: string): boolean {
  return value.startsWith("data:");
}

export function isHttpImage(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

export function isApiProxyImage(value: string): boolean {
  return value.startsWith("/api/");
}

export function storedImageKey(value: string | null | undefined): string | null {
  if (!hasStoredImage(value)) return null;
  const raw = value!.trim();
  if (isDataImage(raw) || isHttpImage(raw) || isApiProxyImage(raw)) return null;
  return raw;
}

/**
 * Wert aus einem JSON-Form-Save, der wirklich persistiert werden darf.
 * Proxy- und Data-URLs werden ignoriert, damit ein Speichern das Logo nicht
 * überschreibt oder erneut als Riesen-Payload in die DB schreibt.
 */
export function persistableImageUrl(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (isApiProxyImage(s) || isDataImage(s)) return undefined;
  if (isHttpImage(s)) return s;
  return undefined;
}

export function toStoredImageSrc(
  stored: string | null | undefined,
  proxyPath: string,
  cacheKey?: string | number | Date | null
): string | null {
  if (!hasStoredImage(stored)) return null;
  const raw = stored!.trim();
  if (isHttpImage(raw) || isApiProxyImage(raw)) return raw;
  const v =
    cacheKey instanceof Date
      ? cacheKey.getTime()
      : cacheKey != null
        ? String(cacheKey)
        : "";
  return v ? `${proxyPath}?v=${encodeURIComponent(v)}` : proxyPath;
}

export function mimeFromStoredName(stored: string, fallback = "image/png"): string {
  const lower = stored.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  if (lower.includes(".gif")) return "image/gif";
  if (lower.includes(".jpg") || lower.includes(".jpeg")) return "image/jpeg";
  return fallback;
}
