import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { syncTeamAppointmentsForOrder } from "@/lib/team-appointments";
import { prisma } from "@/lib/prisma";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!order) return apiError("Auftrag nicht gefunden", 404);
  if (!order.teamId) return apiError("Kein Team zugewiesen", 400);
  if (!order.scheduledStart || !order.scheduledEnd) {
    return apiError("Bitte zuerst Von/Bis-Termin setzen (Mitarbeiter zuweisen)", 400);
  }

  const result = await syncTeamAppointmentsForOrder(auth.tenantId, id);
  return apiSuccess(result);
}
