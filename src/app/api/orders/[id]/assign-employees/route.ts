import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { assignEmployeesSchema } from "@/lib/schemas/orders";
import { assignEmployeesToOrder } from "@/lib/scheduling/assign-employees";
import { requireTenantOrder } from "@/lib/tenant-scope";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.assign");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const order = await requireTenantOrder(auth.tenantId, id);
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const body = await parseBody(request, assignEmployeesSchema);
  if (body instanceof Response) return body;

  try {
    const result = await assignEmployeesToOrder({
      tenantId: auth.tenantId,
      orderId: id,
      employeeIds: body.employeeIds,
      phaseId: body.phaseId,
      startTime: body.startTime ? new Date(body.startTime) : null,
      endTime: body.endTime ? new Date(body.endTime) : null,
      notify: body.notify,
      isTentative: body.isTentative,
    });

    if (result.conflicts.length && !result.created.length && !result.updated.length) {
      return apiError(result.conflicts[0].message, 409);
    }

    return apiSuccess(result, result.created.length || result.updated.length ? 201 : 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Zuweisung fehlgeschlagen";
    return apiError(message, 400);
  }
}
