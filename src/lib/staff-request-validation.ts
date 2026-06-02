import { prisma } from "@/lib/prisma";

const FIELD_ROLES = ["MONTEUR", "MEISTER"] as const;

export type StaffRequestSkipReason =
  | "SELF"
  | "NOT_FIELD_STAFF"
  | "INACTIVE"
  | "ALREADY_ASSIGNED"
  | "PENDING_REQUEST";

export async function validateStaffRequestTargets(
  tenantId: string,
  orderId: string,
  employeeIds: string[],
  requestedByUserId: string
): Promise<{ validIds: string[]; skipped: { employeeId: string; reason: StaffRequestSkipReason }[] }> {
  const requesterEmployee = await prisma.employee.findFirst({
    where: { tenantId, userId: requestedByUserId },
    select: { id: true },
  });

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      appointments: { select: { employeeId: true } },
      staffRequests: {
        where: { status: "PENDING" },
        select: { employeeId: true },
      },
    },
  });

  if (!order) throw new Error("Auftrag nicht gefunden");

  const assignedIds = new Set(order.appointments.map((a) => a.employeeId).filter(Boolean));
  const pendingIds = new Set(order.staffRequests.map((r) => r.employeeId));

  const employees = await prisma.employee.findMany({
    where: { tenantId, id: { in: employeeIds } },
    include: { user: { select: { role: true, isActive: true, firstName: true, lastName: true } } },
  });

  const empMap = new Map(employees.map((e) => [e.id, e]));
  const validIds: string[] = [];
  const skipped: { employeeId: string; reason: StaffRequestSkipReason }[] = [];

  for (const employeeId of employeeIds) {
    if (requesterEmployee && employeeId === requesterEmployee.id) {
      skipped.push({ employeeId, reason: "SELF" });
      continue;
    }

    const emp = empMap.get(employeeId);
    if (!emp || !FIELD_ROLES.includes(emp.user.role as (typeof FIELD_ROLES)[number])) {
      skipped.push({ employeeId, reason: "NOT_FIELD_STAFF" });
      continue;
    }

    if (!emp.user.isActive) {
      skipped.push({ employeeId, reason: "INACTIVE" });
      continue;
    }

    if (assignedIds.has(employeeId)) {
      skipped.push({ employeeId, reason: "ALREADY_ASSIGNED" });
      continue;
    }

    if (pendingIds.has(employeeId)) {
      skipped.push({ employeeId, reason: "PENDING_REQUEST" });
      continue;
    }

    validIds.push(employeeId);
  }

  return { validIds, skipped };
}

export function staffSkipMessage(reason: StaffRequestSkipReason): string {
  switch (reason) {
    case "SELF":
      return "Sie können sich nicht selbst anfragen";
    case "NOT_FIELD_STAFF":
      return "Nur Monteure/Meister können angefragt werden";
    case "INACTIVE":
      return "Mitarbeiter ist deaktiviert";
    case "ALREADY_ASSIGNED":
      return "Bereits eingeplant";
    case "PENDING_REQUEST":
      return "Anfrage bereits offen";
    default:
      return "Nicht verfügbar";
  }
}

/** Field staff eligible for assignment / staff requests on an order */
export async function getAssignableEmployeesForOrder(tenantId: string, orderId: string) {
  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId },
    include: {
      appointments: { select: { employeeId: true } },
      staffRequests: { where: { status: "PENDING" }, select: { employeeId: true } },
    },
  });

  if (!order) throw new Error("Auftrag nicht gefunden");

  const blocked = new Set([
    ...order.appointments.map((a) => a.employeeId).filter(Boolean),
    ...order.staffRequests.map((r) => r.employeeId),
  ]);

  const employees = await prisma.employee.findMany({
    where: { tenantId },
    include: { user: true, qualifications: true },
    orderBy: { user: { lastName: "asc" } },
  });

  return employees
    .filter(
      (e) =>
        e.user.isActive &&
        FIELD_ROLES.includes(e.user.role as (typeof FIELD_ROLES)[number])
    )
    .map((e) => ({
      ...e,
      assignmentStatus: blocked.has(e.id) ? ("busy" as const) : ("available" as const),
    }));
}
