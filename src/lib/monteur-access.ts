import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

export async function getEmployeeForUser(auth: SessionUser) {
  return prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });
}

export async function getTeamIdsForEmployee(employeeId: string) {
  const memberships = await prisma.teamMember.findMany({
    where: { employeeId },
    select: { teamId: true },
  });
  return memberships.map((m) => m.teamId);
}

/** Ob der Mitarbeiter Zugriff auf den Auftrag hat (Termin, Phase, Team). */
export async function employeeCanAccessOrder(
  tenantId: string,
  employeeId: string,
  orderId: string
): Promise<boolean> {
  const teamIds = await getTeamIdsForEmployee(employeeId);

  const hasAppointment = await prisma.appointment.findFirst({
    where: {
      orderId,
      tenantId,
      status: { not: "STORNIERT" },
      OR: [
        { employeeId },
        ...(teamIds.length
          ? [{ order: { teamId: { in: teamIds } } }]
          : []),
      ],
    },
    select: { id: true },
  });
  if (hasAppointment) return true;

  const hasPhase = await prisma.orderPhase.findFirst({
    where: {
      orderId,
      order: { tenantId },
      OR: [
        { assignedEmployeeId: employeeId },
        ...(teamIds.length ? [{ assignedTeamId: { in: teamIds } }] : []),
      ],
    },
    select: { id: true },
  });
  if (hasPhase) return true;

  if (teamIds.length) {
    const teamOrder = await prisma.order.findFirst({
      where: { id: orderId, tenantId, teamId: { in: teamIds } },
      select: { id: true },
    });
    if (teamOrder) return true;
  }

  return false;
}

export async function requireMonteurAppointment(
  auth: SessionUser,
  appointmentId: string
) {
  const employee = await getEmployeeForUser(auth);
  if (!employee) return { error: apiError("Kein Mitarbeiterprofil", 403) };

  const teamIds = await getTeamIdsForEmployee(employee.id);

  const appointment = await prisma.appointment.findFirst({
    where: {
      id: appointmentId,
      tenantId: auth.tenantId,
      OR: [
        { employeeId: employee.id },
        ...(teamIds.length
          ? [{ order: { teamId: { in: teamIds } } }]
          : []),
      ],
    },
    include: {
      order: { include: { checklists: true } },
    },
  });
  if (!appointment) return { error: apiError("Termin nicht gefunden oder kein Zugriff", 404) };

  return { employee, appointment };
}

export async function requireMonteurOrder(auth: SessionUser, orderId: string) {
  const employee = await getEmployeeForUser(auth);
  if (!employee) return { error: apiError("Kein Mitarbeiterprofil", 403) };

  // Büro/Meister mit orders.write dürfen Zeiten auf alle Aufträge des Tenants buchen
  const officeAccess = hasPermission(auth.role, "orders.write");
  if (!officeAccess) {
    const ok = await employeeCanAccessOrder(auth.tenantId, employee.id, orderId);
    if (!ok) return { error: apiError("Kein Zugriff auf diesen Auftrag", 403) };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
    include: { checklists: true },
  });
  if (!order) return { error: apiError("Auftrag nicht gefunden", 404) };

  return { employee, order };
}
