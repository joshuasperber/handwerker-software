import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";

const ALLOWED_ROLES: UserRole[] = ["ADMIN", "MEISTER", "BUERO", "MONTEUR"];

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
  } = body;

  if (role && !ALLOWED_ROLES.includes(role)) {
    return apiError("Ungültige Rolle", 400);
  }

  if (email && email.toLowerCase() !== employee.user.email) {
    const existing = await prisma.user.findFirst({
      where: { tenantId: auth.tenantId, email: email.toLowerCase(), NOT: { id: employee.userId } },
    });
    if (existing) return apiError("E-Mail bereits vergeben", 400);
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
      ...(isActive !== undefined ? { isActive } : {}),
      // Setzt der Admin ein neues Passwort, gilt es als Reset: der Mitarbeiter
      // muss es beim nächsten Login erneut ändern.
      ...(password
        ? { passwordHash: await hashPassword(password), mustChangePassword: true }
        : {}),
    },
  });

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
    },
    include: { user: true, qualifications: true },
  });

  return apiSuccess(updated);
}
