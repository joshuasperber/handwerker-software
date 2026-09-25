export function normalizeOptionalHttpUrl(
  value: unknown,
  label: string
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") throw new Error(`${label} ist ungültig`);

  const trimmed = value.trim();
  if (!trimmed) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${label} muss eine vollständige URL sein (https://…)`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`${label} muss mit https:// oder http:// beginnen`);
  }

  return parsed.toString();
}
