import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";
import { pickDistinctEmployeeColor } from "@/lib/employee-colors";
import { createSupabaseAuthUser } from "@/lib/supabase/auth-users";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";
import { ASSIGNABLE_STAFF_ROLES, hasPermission } from "@/lib/permissions";
import { createAuditLog } from "@/lib/audit";

/** Initialpasswort, mit dem sich jeder neu angelegte Mitarbeiter anmelden kann. */
const DEFAULT_EMPLOYEE_PASSWORD = "admin1234";

export async function GET() {
  const auth = await requireAuth("employees.read");
  if (auth instanceof Response) return auth;

  const employees = await prisma.employee.findMany({
    where: { tenantId: auth.tenantId },
    include: {
      user: true,
      qualifications: true,
      workingHours: true,
    },
  });

  return apiSuccess(employees);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("employees.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const {
    email,
    password,
    firstName,
    lastName,
    role,
    phone,
    address,
    color,
    qualifications,
    canManageRoles,
  } = body;

  if (!email || !firstName || !lastName || !role) {
    return apiError("E-Mail, Vorname, Nachname und Rolle sind Pflicht", 400);
  }
  if (!ASSIGNABLE_STAFF_ROLES.includes(role as UserRole)) {
    return apiError("Ungültige Rolle", 400);
  }

  const wantsRoleManage = hasPermission(auth.role, "roles.manage", {
    canManageRoles: auth.canManageRoles,
  });

  if (role === "ADMIN" && auth.role !== "ADMIN") {
    return apiError("Nur Administratoren können Admin-Rollen vergeben", 403);
  }
  if (!wantsRoleManage && role !== "MONTEUR" && role !== "AUSHILFE") {
    return apiError(
      "Ohne Rollenverwaltung können nur Monteur oder Aushilfe angelegt werden",
      403
    );
  }

  let manageRolesFlag = false;
  if (canManageRoles === true) {
    if (!wantsRoleManage) return apiError("Keine Berechtigung für Rollenverwaltung", 403);
    if (role !== "BUERO" && role !== "ADMIN") {
      return apiError("Rollenverwaltung nur für Büro oder Admin", 400);
    }
    manageRolesFlag = role === "BUERO" ? true : false;
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const startPassword = password || DEFAULT_EMPLOYEE_PASSWORD;

  const existing = await prisma.user.findFirst({
    where: { tenantId: auth.tenantId, email: normalizedEmail },
  });
  if (existing) return apiError("E-Mail bereits vergeben", 400);

  let supabaseUserId: string | null = null;
  if (isSupabaseAuthConfigured()) {
    const created = await createSupabaseAuthUser({
      email: normalizedEmail,
      password: startPassword,
      firstName,
      lastName,
    });
    if (!created.ok) return apiError(created.error, 400);
    supabaseUserId = created.supabaseUserId;
  }

  const passwordHash = await hashPassword(startPassword);
  const employeeColor = color ?? (await pickDistinctEmployeeColor(auth.tenantId));

  const user = await prisma.user.create({
    data: {
      tenantId: auth.tenantId,
      email: normalizedEmail,
      passwordHash,
      supabaseUserId,
      firstName,
      lastName,
      phone: phone || null,
      address: address || null,
      role,
      canManageRoles: manageRolesFlag,
      mustChangePassword: true,
    },
  });

  const employee = await prisma.employee.create({
    data: {
      tenantId: auth.tenantId,
      userId: user.id,
      color: employeeColor,
      qualifications: qualifications?.length
        ? { create: qualifications.map((name: string) => ({ name })) }
        : undefined,
    },
    include: { user: true, qualifications: true },
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "User",
    entityId: user.id,
    action: "EMPLOYEE_CREATE",
    newValues: { role, canManageRoles: manageRolesFlag, email: normalizedEmail },
  });

  return apiSuccess(employee, 201);
}
