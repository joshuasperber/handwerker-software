import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { findEmployeeScheduleConflict } from "@/lib/disposition/schedule-conflicts";

/** Prüft Verfügbarkeit vor Termin-Anlage (UI-Vorschau). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const { searchParams } = request.nextUrl;
  const employeeId = searchParams.get("employeeId");
  const startTime = searchParams.get("startTime");
  const endTime = searchParams.get("endTime");

  if (!employeeId || !startTime || !endTime) {
    return apiError("employeeId, startTime und endTime erforderlich", 400);
  }

  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: auth.tenantId } });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const conflict = await findEmployeeScheduleConflict(
    auth.tenantId,
    employeeId,
    new Date(startTime),
    new Date(endTime)
  );

  return apiSuccess({ available: !conflict, conflict });
}
