import type { UserRole } from "@/generated/prisma/enums";

const FIELD_HOME_ROLES: UserRole[] = ["MONTEUR", "TEAMLEITER", "AUSHILFE"];
const OFFICE_HOME_ROLES: UserRole[] = ["ADMIN", "BUERO", "MEISTER"];

/** Ob preferredView-Cookie für den bewussten Ansichtswechsel genutzt werden darf (nur Office). */
export function canUsePreferredViewCookie(role: UserRole): boolean {
  return OFFICE_HOME_ROLES.includes(role);
}

function isFieldHomeRole(role: UserRole): boolean {
  return FIELD_HOME_ROLES.includes(role);
}

function isOfficeHomeRole(role: UserRole): boolean {
  return OFFICE_HOME_ROLES.includes(role);
}

/**
 * Startseite nach Login, App-Start und „Zurück zur App“.
 * Admin/Büro/Meister → Verwaltung. Monteur/Teamleiter/Aushilfe → Arbeit.
 * Der letzte Ansichtswechsel (Cookie) ändert die Startansicht nicht.
 */
export function getRoleHomePath(
  role: UserRole,
  options?: { mustChangePassword?: boolean }
): string {
  if (options?.mustChangePassword) {
    if (isFieldHomeRole(role)) return "/monteur/profil?changePassword=1";
    return "/dashboard/profil?changePassword=1";
  }
  if (role === "GAST") return "/portal";
  if (role === "KUNDE") return "/kunde";
  if (isFieldHomeRole(role)) return "/monteur/heute";
  return "/dashboard";
}

/** Beschriftung für den Rückweg aus öffentlichen Seiten (AGB, Startseite, …). */
export function getAppReturnLabel(role: UserRole): string {
  if (isOfficeHomeRole(role)) return "Zum Dashboard";
  if (role === "KUNDE") return "Zum Kundenportal";
  if (role === "GAST") return "Zum Portal";
  return "Zurück zur App";
}
