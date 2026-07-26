import { prisma } from "@/lib/prisma";
import { pickDistinctEmployeeColor } from "@/lib/employee-colors";
import type { UserRole } from "@/generated/prisma/client";

const ROLES_WITH_EMPLOYEE_PROFILE: UserRole[] = ["ADMIN", "MEISTER", "BUERO", "MONTEUR"];

/** Legt ein Mitarbeiterprofil an, falls der Nutzer noch keins hat (z. B. nach Einladung). */
export async function ensureEmployeeProfile(userId: string, tenantId: string, role: UserRole) {
  if (!ROLES_WITH_EMPLOYEE_PROFILE.includes(role)) return null;

  const existing = await prisma.employee.findFirst({
    where: { userId, tenantId },
  });
  if (existing) return existing;

  const color = await pickDistinctEmployeeColor(tenantId);
  return prisma.employee.create({
    data: { tenantId, userId, color },
  });
}
