import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createCalculationFromOrder } from "@/lib/calculation/build-from-order";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const calculation = await prisma.calculation.findFirst({
    where: { tenantId: auth.tenantId, orderId: id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      netSalesPrice: true,
      grossSalesPrice: true,
      updatedAt: true,
    },
  });

  return apiSuccess({ calculation });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;

  try {
    const result = await createCalculationFromOrder(auth.tenantId, id);
    return apiSuccess(result, result.created ? 201 : 200);
  } catch (err) {
    console.error("[order calculation]", err);
    return apiError(err instanceof Error ? err.message : "Kalkulation fehlgeschlagen", 500);
  }
}
