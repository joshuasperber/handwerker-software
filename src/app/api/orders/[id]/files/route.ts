import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { isValidFileCategory } from "@/lib/files";
import { uploadOrderFiles, listOrderPhotoFiles } from "@/lib/orders/order-files";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const formData = await request.formData();
  const result = await uploadOrderFiles({
    orderId,
    userId: auth.id,
    formData,
    resolveCategory: (raw) => (isValidFileCategory(raw) ? raw : "KUNDENFOTO"),
  });

  if (result instanceof Response) return result;
  return apiSuccess(result, 201);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const { searchParams } = new URL(request.url);

  const withUrls = await listOrderPhotoFiles({
    orderId,
    tenantId: auth.tenantId,
    phaseFilter: searchParams.get("orderPhaseId"),
  });

  return apiSuccess(withUrls);
}
