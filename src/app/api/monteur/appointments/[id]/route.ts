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

  const { appointment, employee } = access;
  const { status } = body;
  if (!status) return apiError("status fehlt", 400);
  if (!isMonteurAppointmentStatus(status)) {
    return apiError("Ungültiger Status für Monteur", 400);
  }
  if (
    appointment.order &&
    ["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"].includes(
      appointment.order.status
    )
  ) {
    return apiError("Der Status eines abgeschlossenen Auftrags kann nicht geändert werden.", 409);
  }

  let completionOrderStatus: "ABRECHNUNGSBEREIT" | null = null;
  if (status === "ABGESCHLOSSEN" && appointment.order) {
    if (!areOrderChecklistsComplete(appointment.order.checklists)) {
      return apiError("Bitte zuerst alle Punkte der Checkliste erledigen.", 409);
    }
    const openTime = await prisma.timeEntry.findFirst({
      where: { orderId: appointment.orderId, employeeId: employee.id, endTime: null },
      select: { id: true },
    });
    if (openTime) {
      return apiError("Bitte zuerst die laufende Arbeitszeit beenden.", 409);
    }
    completionOrderStatus = "ABRECHNUNGSBEREIT";
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

  if (orderStatusMap[status] && appointment.orderId && appointment.order) {
    const newOrderStatus = completionOrderStatus ?? orderStatusMap[status];
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
