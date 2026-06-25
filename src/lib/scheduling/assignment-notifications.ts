import { prisma } from "@/lib/prisma";
import { createInAppNotification } from "@/lib/notifications";
import { formatDateTime } from "@/lib/utils";

export async function notifyEmployeesAssigned(params: {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  employeeIds: string[];
  startTime?: Date | null;
  endTime?: Date | null;
  phaseName?: string | null;
}) {
  if (!params.employeeIds.length) return;

  const employees = await prisma.employee.findMany({
    where: { id: { in: params.employeeIds }, tenantId: params.tenantId },
    include: { user: { select: { id: true, firstName: true } } },
  });

  const timeHint =
    params.startTime && params.endTime
      ? formatDateTime(params.startTime)
      : "Termin folgt";
  const phaseHint = params.phaseName ? ` (${params.phaseName})` : "";

  await Promise.all(
    employees.map((emp) =>
      createInAppNotification({
        tenantId: params.tenantId,
        userId: emp.user.id,
        type: "TERMIN_ZUWEISUNG",
        title: `Neuer Einsatz: ${params.orderNumber}`,
        body: `${timeHint}${phaseHint}`,
        link: `/monteur/auftrag/${params.orderId}`,
      })
    )
  );
}

export async function notifyStaffRequestCreated(params: {
  tenantId: string;
  orderId: string;
  orderNumber: string;
  employeeId: string;
  message?: string | null;
}) {
  const employee = await prisma.employee.findFirst({
    where: { id: params.employeeId, tenantId: params.tenantId },
    include: { user: { select: { id: true } } },
  });
  if (!employee) return;

  await createInAppNotification({
    tenantId: params.tenantId,
    userId: employee.user.id,
    type: "TERMIN_ZUWEISUNG",
    title: `Einsatz-Anfrage: ${params.orderNumber}`,
    body: params.message?.trim() || "Bitte im Tagesplan annehmen oder ablehnen.",
    link: `/monteur/tagesplan`,
  });
}

export async function notifyStaffRequestResponded(params: {
  tenantId: string;
  requestedById: string;
  orderNumber: string;
  employeeName: string;
  accepted: boolean;
}) {
  await createInAppNotification({
    tenantId: params.tenantId,
    userId: params.requestedById,
    type: "SYSTEM",
    title: params.accepted ? "Anfrage angenommen" : "Anfrage abgelehnt",
    body: `${params.employeeName} — ${params.orderNumber}`,
    link: `/dashboard/auftraege`,
  });
}
