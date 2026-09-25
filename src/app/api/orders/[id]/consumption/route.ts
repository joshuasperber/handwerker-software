import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { bookOrderConsumption } from "@/lib/inventory/consumption";
import { prisma } from "@/lib/prisma";
import { validateConsumptionLines } from "@/lib/inventory/consumption-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const body = await request.json();
  const parsed = validateConsumptionLines(body.lines);
  if ("error" in parsed) return apiError(parsed.error, 400);

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
    select: {
      id: true,
      status: true,
      assignees: { select: { employeeId: true }, take: 1 },
      appointments: {
        where: { employeeId: { not: null }, status: { not: "STORNIERT" } },
        select: { employeeId: true },
        orderBy: { startTime: "desc" },
        take: 1,
      },
    },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);
  if (["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"].includes(order.status)) {
    return apiError("Für diesen abgeschlossenen Auftrag kann kein Verbrauch gebucht werden.", 409);
  }

  const actingEmployee = await prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
    select: { id: true },
  });
  const employeeId =
    actingEmployee?.id ??
    order.assignees[0]?.employeeId ??
    order.appointments[0]?.employeeId;
  if (!employeeId) {
    return apiError(
      "Materialverbrauch benötigt einen zugewiesenen Mitarbeiter.",
      409
    );
  }

  const status = await bookOrderConsumption({
    tenantId: auth.tenantId,
    orderId,
    employeeId,
    lines: parsed.lines,
  });

  return apiSuccess({ materialStatus: status });
}
