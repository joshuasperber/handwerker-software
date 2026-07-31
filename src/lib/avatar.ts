/**
 * Avatar-Speicherformate in User.avatarUrl:
 * - `data:image/...;base64,...` — Legacy, inline in der DB
 * - `https://...` / `http://...` — öffentliche URL
 * - sonst — S3-Storage-Key (z. B. `avatars/<tenant>/<uuid>.jpg`)
 */

export function hasStoredAvatar(avatarUrl: string | null | undefined): boolean {
  return Boolean(avatarUrl && avatarUrl.trim());
}

export function isDataAvatar(avatarUrl: string): boolean {
  return avatarUrl.startsWith("data:");
}

export function isHttpAvatar(avatarUrl: string): boolean {
  return /^https?:\/\//i.test(avatarUrl);
}

/** Client-/Layout-Src für <img>; immer über Proxy außer bei öffentlicher URL. */
export function toAvatarSrc(
  avatarUrl: string | null | undefined,
  cacheKey?: string | number | Date | null
): string | null {
  if (!hasStoredAvatar(avatarUrl)) return null;
  const raw = avatarUrl!.trim();
  if (isHttpAvatar(raw)) return raw;
  const v =
    cacheKey instanceof Date
      ? cacheKey.getTime()
      : cacheKey != null
        ? String(cacheKey)
        : "";
  return v ? `/api/profile/avatar?v=${encodeURIComponent(v)}` : "/api/profile/avatar";
}

/** S3-Key aus gespeichertem Wert (null bei Data-URL / HTTP). */
export function avatarStorageKey(avatarUrl: string | null | undefined): string | null {
  if (!hasStoredAvatar(avatarUrl)) return null;
  const raw = avatarUrl!.trim();
  if (isDataAvatar(raw) || isHttpAvatar(raw)) return null;
  return raw;
}
