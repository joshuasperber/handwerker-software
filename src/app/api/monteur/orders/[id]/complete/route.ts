import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { auditOrderStatusChange } from "@/lib/audit";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access) return access.error;

  const body = await request.json();
  const ip = getClientIp(request);

  const checklists = await prisma.orderChecklist.findMany({ where: { orderId } });
  const allDone = checklists.length === 0 || checklists.every((c) => c.isChecked);

  let newStatus = body.status ?? "ABGESCHLOSSEN";
  if (newStatus === "ABGESCHLOSSEN" && allDone) {
    newStatus = "ABRECHNUNGSBEREIT";
  }

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      status: newStatus,
      ...(body.internalNotes !== undefined ? { internalNotes: body.internalNotes } : {}),
      ...(body.completionResult ? { completionResult: body.completionResult } : {}),
      completedAt: new Date(),
    },
  });

  await prisma.appointment.updateMany({
    where: { orderId, employeeId: access.employee.id, tenantId: auth.tenantId },
    data: { status: "ABGESCHLOSSEN" },
  });

  if (newStatus !== access.order.status) {
    await auditOrderStatusChange(auth, orderId, access.order.status, newStatus, ip);
  }

  return apiSuccess(order);
}
