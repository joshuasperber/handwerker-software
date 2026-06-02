import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { hashPassword } from "@/lib/auth";
import type { UserRole } from "@/generated/prisma/client";
import { pickDistinctEmployeeColor } from "@/lib/employee-colors";

const ALLOWED_ROLES: UserRole[] = ["ADMIN", "MEISTER", "BUERO", "MONTEUR"];

/** Standard-Passwort, mit dem sich jeder neu angelegte Mitarbeiter anmelden kann. */
const DEFAULT_EMPLOYEE_PASSWORD = "demo1234";

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
  const { email, password, firstName, lastName, role, phone, color, qualifications } = body;

  if (!email || !firstName || !lastName || !role) {
    return apiError("E-Mail, Vorname, Nachname und Rolle sind Pflicht", 400);
  }
  if (!ALLOWED_ROLES.includes(role)) {
    return apiError("Ungültige Rolle", 400);
  }

  const existing = await prisma.user.findFirst({
    where: { tenantId: auth.tenantId, email: email.toLowerCase() },
  });
  if (existing) return apiError("E-Mail bereits vergeben", 400);

  // Ohne explizites Passwort kann sich der Mitarbeiter mit dem Standard-Passwort anmelden.
  const passwordHash = await hashPassword(password || DEFAULT_EMPLOYEE_PASSWORD);
  const employeeColor = color ?? (await pickDistinctEmployeeColor(auth.tenantId));

  const user = await prisma.user.create({
    data: {
      tenantId: auth.tenantId,
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      phone,
      role,
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

  return apiSuccess(employee, 201);
}
