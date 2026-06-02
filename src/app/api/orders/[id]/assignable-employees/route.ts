import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getAssignableEmployeesForOrder } from "@/lib/staff-request-validation";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const order = await prisma.order.findFirst({ where: { id: orderId, tenantId: auth.tenantId } });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const employees = await getAssignableEmployeesForOrder(auth.tenantId, orderId);
  return apiSuccess(employees);
}
