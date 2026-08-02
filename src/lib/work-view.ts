/** Cookie/Query für den Wechsel zwischen Verwaltungs- und Arbeitsansicht. */
export const WORK_VIEW_COOKIE = "jomaster-app-view";

export type AppViewMode = "verwaltung" | "arbeit";

export function parseAppViewMode(value: string | null | undefined): AppViewMode | null {
  if (value === "verwaltung" || value === "arbeit") return value;
  return null;
}
