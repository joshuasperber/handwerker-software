import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import type { OrderStatus } from "@/generated/prisma/client";
import { auditOrderStatusChange } from "@/lib/audit";
import { areOrderChecklistsComplete } from "@/lib/orders/checklist";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access) return access.error;

  if (access.order.status === "ABRECHNUNGSBEREIT") {
    return apiSuccess(access.order);
  }
  if (["ABGERECHNET", "STORNIERT"].includes(access.order.status)) {
    return apiError(
      access.order.status === "ABGERECHNET"
        ? "Ein bereits abgerechneter Auftrag kann nicht erneut abgeschlossen werden."
        : "Ein stornierter Auftrag kann nicht abgeschlossen werden.",
      409
    );
  }

  const body = await request.json();
  const ip = getClientIp(request);

  const checklists = await prisma.orderChecklist.findMany({ where: { orderId } });
  const allDone = areOrderChecklistsComplete(checklists);

  if (!allDone) {
    return apiError("Bitte zuerst alle Punkte der Checkliste erledigen.", 409);
  }

  const openTime = await prisma.timeEntry.findFirst({
    where: {
      orderId,
      employeeId: access.employee.id,
      endTime: null,
    },
    select: { id: true },
  });
  if (openTime) {
    return apiError("Bitte zuerst die laufende Arbeitszeit beenden.", 409);
  }

  const newStatus: OrderStatus = "ABRECHNUNGSBEREIT";

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

  await auditOrderStatusChange(auth, orderId, access.order.status, newStatus, ip);

  return apiSuccess(order);
}
