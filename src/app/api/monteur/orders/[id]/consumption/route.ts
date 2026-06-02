import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { bookOrderConsumption } from "@/lib/inventory/consumption";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access) return access.error;

  const body = await request.json();
  const lines = body.lines as { lineId: string; quantityConsumed: number; returned?: number }[];
  if (!lines?.length) return apiError("lines erforderlich", 400);

  const status = await bookOrderConsumption({
    tenantId: auth.tenantId,
    orderId,
    lines,
  });

  return apiSuccess({ materialStatus: status });
}
