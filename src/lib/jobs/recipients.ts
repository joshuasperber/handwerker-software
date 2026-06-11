import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/client";
import { hasPermission, type Permission } from "@/lib/permissions";

/** Aktive Nutzer-IDs eines Tenants, deren Rolle die angegebene Berechtigung hat. */
export async function getTenantUserIdsByPermission(
  tenantId: string,
  permission: Permission
): Promise<string[]> {
  const roles = (Object.values(UserRole) as UserRole[]).filter((r) =>
    hasPermission(r, permission)
  );
  if (roles.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: roles } },
    select: { id: true },
  });
  return users.map((u) => u.id);
}
