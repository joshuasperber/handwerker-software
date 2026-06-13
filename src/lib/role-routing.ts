import type { UserRole } from "@/generated/prisma/enums";

/** Startseite nach Login / Einladung je nach Rolle. */
export function getRoleHomePath(
  role: UserRole,
  options?: { mustChangePassword?: boolean }
): string {
  if (options?.mustChangePassword) return "/dashboard/profil?changePassword=1";
  switch (role) {
    case "GAST":
      return "/portal";
    case "MONTEUR":
      return "/monteur/tagesplan";
    case "KUNDE":
      return "/kunde";
    default:
      return "/dashboard";
  }
}
