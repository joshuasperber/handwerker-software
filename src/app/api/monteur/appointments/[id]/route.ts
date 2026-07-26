import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { requireMonteurAppointment } from "@/lib/monteur-access";
import { prisma } from "@/lib/prisma";
import { auditEntityChange, auditOrderStatusChange } from "@/lib/audit";
import { areOrderChecklistsComplete } from "@/lib/orders/checklist";
import { isMonteurAppointmentStatus } from "@/lib/scheduling/monteur-status";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const ip = getClientIp(request);

  const access = await requireMonteurAppointment(auth, id);
  if ("error" in access && access.error) return access.error;

  const { appointment, employee: _employee } = access;
  const { status } = body;
  if (!status) return apiError("status fehlt", 400);
  if (!isMonteurAppointmentStatus(status)) {
    return apiError("Ungültiger Status für Monteur", 400);
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status },
    include: {
      order: { include: { customer: true, property: true, checklists: true } },
    },
  });

  const orderStatusMap: Record<string, string> = {
    UNTERWEGS: "UNTERWEGS",
    ANGEKOMMEN: "UNTERWEGS",
    IN_ARBEIT: "IN_ARBEIT",
    ABGESCHLOSSEN: "ABGESCHLOSSEN",
  };

  if (orderStatusMap[status]) {
    let newOrderStatus = orderStatusMap[status];
    if (status === "ABGESCHLOSSEN") {
      const allDone = areOrderChecklistsComplete(appointment.order.checklists);
      if (allDone) newOrderStatus = "ABRECHNUNGSBEREIT";
    }
    await auditOrderStatusChange(auth, appointment.orderId, appointment.order.status, newOrderStatus, ip);
    await prisma.order.update({
      where: { id: appointment.orderId },
      data: {
        status: newOrderStatus as never,
        ...(status === "ABGESCHLOSSEN" ? { completedAt: new Date() } : {}),
      },
    });
  }

  await auditEntityChange(auth, "Appointment", id, "UPDATE", appointment, body, ip);
  return apiSuccess(updated);
}
