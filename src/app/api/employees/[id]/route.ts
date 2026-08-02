import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import { bumpSessionVersion } from "@/lib/auth/session-version";
import type { UserRole } from "@/generated/prisma/client";
import { ASSIGNABLE_STAFF_ROLES, hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("employees.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const employee = await prisma.employee.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { user: true, qualifications: true, workingHours: true },
  });

  if (!employee) return apiError("Mitarbeiter nicht gefunden", 404);
  return apiSuccess(employee);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("employees.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const employee = await prisma.employee.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { user: true, qualifications: true },
  });
  if (!employee) return apiError("Mitarbeiter nicht gefunden", 404);

  const {
    firstName,
    lastName,
    email,
    phone,
    address,
    role,
    password,
    color,
    qualifications,
    isActive,
    operationalStatus,
    hourlyWageNet,
    canManageRoles,
  } = body;

  const canManageRoleAssignments = hasPermission(auth.role, "roles.manage", {
    canManageRoles: auth.canManageRoles,
  });

  if (role !== undefined && role !== employee.user.role) {
    if (!ASSIGNABLE_STAFF_ROLES.includes(role as UserRole)) {
      return apiError("Ungültige Rolle", 400);
    }
    if (!canManageRoleAssignments) {
      return apiError("Keine Berechtigung, Rollen zu ändern", 403);
    }
    if (role === "ADMIN" && auth.role !== "ADMIN") {
      return apiError("Nur Administratoren können Admin-Rollen vergeben", 403);
    }
    if (employee.userId === auth.id) {
      return apiError("Die eigene Rolle kann nicht selbst geändert werden", 403);
    }
  }

  if (canManageRoles !== undefined) {
    if (!canManageRoleAssignments) {
      return apiError("Keine Berechtigung für Rollenverwaltung", 403);
    }
    if (employee.userId === auth.id) {
      return apiError("Das eigene Rollenverwaltungsrecht kann nicht selbst geändert werden", 403);
    }
  }

  if (email && email.toLowerCase() !== employee.user.email) {
    const existing = await prisma.user.findFirst({
      where: {
        tenantId: auth.tenantId,
        email: email.toLowerCase(),
        NOT: { id: employee.userId },
      },
    });
    if (existing) return apiError("E-Mail bereits vergeben", 400);
  }

  const roleChanged = role !== undefined && role !== employee.user.role;
  const deactivate = isActive === false && employee.user.isActive;

  const nextRole = (role ?? employee.user.role) as UserRole;
  let nextCanManageRoles = employee.user.canManageRoles;
  if (canManageRoles !== undefined) {
    nextCanManageRoles = Boolean(canManageRoles) && nextRole === "BUERO";
  } else if (roleChanged && nextRole !== "BUERO") {
    nextCanManageRoles = false;
  }

  if (password) {
    const { createSupabaseAuthUser, updateSupabaseAuthPassword } = await import(
      "@/lib/supabase/auth-users"
    );
    const { isSupabaseAuthConfigured } = await import("@/lib/supabase/env");
    if (isSupabaseAuthConfigured()) {
      if (employee.user.supabaseUserId) {
        const updatedAuth = await updateSupabaseAuthPassword(
          employee.user.supabaseUserId,
          password
        );
        if (!updatedAuth.ok) return apiError(updatedAuth.error, 400);
      } else {
        const created = await createSupabaseAuthUser({
          email: (email ?? employee.user.email).toLowerCase(),
          password,
          firstName: firstName ?? employee.user.firstName,
          lastName: lastName ?? employee.user.lastName,
        });
        if (!created.ok) return apiError(created.error, 400);
        await prisma.user.update({
          where: { id: employee.userId },
          data: { supabaseUserId: created.supabaseUserId },
        });
      }
    }
  }

  await prisma.user.update({
    where: { id: employee.userId },
    data: {
      ...(firstName !== undefined ? { firstName } : {}),
      ...(lastName !== undefined ? { lastName } : {}),
      ...(email !== undefined ? { email: email.toLowerCase() } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(address !== undefined ? { address: address || null } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(canManageRoles !== undefined || roleChanged
        ? { canManageRoles: nextCanManageRoles }
        : {}),
      ...(isActive !== undefined ? { isActive } : {}),
      ...(password
        ? { passwordHash: await hashPassword(password), mustChangePassword: true }
        : {}),
    },
  });

  if (password || roleChanged || deactivate || canManageRoles !== undefined) {
    await bumpSessionVersion(employee.userId);
  }

  if (roleChanged || canManageRoles !== undefined) {
    await createAuditLog({
      tenantId: auth.tenantId,
      userId: auth.id,
      entityType: "User",
      entityId: employee.userId,
      action: "ROLE_CHANGE",
      oldValues: {
        role: employee.user.role,
        canManageRoles: employee.user.canManageRoles,
      },
      newValues: {
        role: nextRole,
        canManageRoles: nextCanManageRoles,
      },
    });
  }

  if (qualifications !== undefined) {
    await prisma.employeeQualification.deleteMany({ where: { employeeId: id } });
    if (qualifications.length) {
      await prisma.employeeQualification.createMany({
        data: qualifications.map((name: string) => ({ employeeId: id, name })),
      });
    }
  }

  const updated = await prisma.employee.update({
    where: { id },
    data: {
      ...(color !== undefined ? { color } : {}),
      ...(operationalStatus !== undefined ? { operationalStatus } : {}),
      ...(hourlyWageNet !== undefined
        ? {
            hourlyWageNet:
              hourlyWageNet === null || hourlyWageNet === ""
                ? null
                : Number(hourlyWageNet),
          }
        : {}),
    },
    include: { user: true, qualifications: true },
  });

  return apiSuccess(updated);
}
