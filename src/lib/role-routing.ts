import type { UserRole } from "@/generated/prisma/enums";

const FIELD_HOME_ROLES: UserRole[] = ["MONTEUR", "TEAMLEITER", "AUSHILFE"];
const OFFICE_HOME_ROLES: UserRole[] = ["ADMIN", "BUERO", "MEISTER"];

/** Ob preferredView-Cookie beim Login berücksichtigt werden darf (nur Office). */
export function canUsePreferredViewCookie(role: UserRole): boolean {
  return OFFICE_HOME_ROLES.includes(role);
}

function isFieldHomeRole(role: UserRole): boolean {
  return FIELD_HOME_ROLES.includes(role);
}

/** Startseite nach Login / Einladung je nach Rolle. */
export function getRoleHomePath(
  role: UserRole,
  options?: { mustChangePassword?: boolean; preferredView?: "verwaltung" | "arbeit" | null }
): string {
  if (options?.mustChangePassword) {
    // Feldrollen bleiben in der Arbeitsansicht — kein Sprung ins Dashboard-Layout.
    if (isFieldHomeRole(role)) return "/monteur/profil?changePassword=1";
    return "/dashboard/profil?changePassword=1";
  }
  if (role === "GAST") return "/portal";
  if (role === "KUNDE") return "/kunde";

  // Ansichts-Cookie nur für Office — Monteure starten immer in der Arbeitsansicht.
  if (canUsePreferredViewCookie(role)) {
    if (options?.preferredView === "arbeit") return "/monteur/heute";
    if (options?.preferredView === "verwaltung") return "/dashboard";
  }

  if (isFieldHomeRole(role)) return "/monteur/heute";
  return "/dashboard";
}
