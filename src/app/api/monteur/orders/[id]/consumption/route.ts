import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { bookOrderConsumption } from "@/lib/inventory/consumption";
import { validateConsumptionLines } from "@/lib/inventory/consumption-validation";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access) return access.error;
  if (["ABRECHNUNGSBEREIT", "ABGERECHNET", "STORNIERT"].includes(access.order.status)) {
    return apiError("Für diesen abgeschlossenen Auftrag kann kein Verbrauch gebucht werden.", 409);
  }

  const body = await request.json();
  const parsed = validateConsumptionLines(body.lines);
  if ("error" in parsed) return apiError(parsed.error, 400);

  const status = await bookOrderConsumption({
    tenantId: auth.tenantId,
    orderId,
    employeeId: access.employee.id,
    lines: parsed.lines,
  });

  return apiSuccess({ materialStatus: status });
}
