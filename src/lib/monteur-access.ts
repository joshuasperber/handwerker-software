import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import type { SessionUser } from "@/lib/auth";

export async function getEmployeeForUser(auth: SessionUser) {
  return prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });
}

export async function requireMonteurAppointment(
  auth: SessionUser,
  appointmentId: string
) {
  const employee = await getEmployeeForUser(auth);
  if (!employee) return { error: apiError("Kein Mitarbeiterprofil", 403) };

  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, tenantId: auth.tenantId, employeeId: employee.id },
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

  const hasAppointment = await prisma.appointment.findFirst({
    where: { orderId, tenantId: auth.tenantId, employeeId: employee.id },
  });

  if (!hasAppointment) {
    const hasPhase = await prisma.orderPhase.findFirst({
      where: {
        orderId,
        assignedEmployeeId: employee.id,
        order: { tenantId: auth.tenantId },
      },
    });
    if (!hasPhase) return { error: apiError("Kein Zugriff auf diesen Auftrag", 403) };
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
    include: { checklists: true },
  });
  if (!order) return { error: apiError("Auftrag nicht gefunden", 404) };

  return { employee, order };
}
