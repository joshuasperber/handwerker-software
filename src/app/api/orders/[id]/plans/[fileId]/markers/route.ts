import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId, fileId } = await params;

  const markers = await prisma.planMarker.findMany({
    where: {
      orderId,
      fileId,
      order: { tenantId: auth.tenantId },
    },
    include: { article: true },
    orderBy: { createdAt: "asc" },
  });

  return apiSuccess(markers);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId, fileId } = await params;
  const body = await request.json();

  const file = await prisma.fileUpload.findFirst({
    where: { id: fileId, orderId, order: { tenantId: auth.tenantId } },
  });
  if (!file) return apiError("Plan nicht gefunden", 404);

  const marker = await prisma.planMarker.create({
    data: {
      orderId,
      fileId,
      markerType: body.markerType ?? "SONSTIGES",
      label: body.label,
      posX: Number(body.posX ?? 0),
      posY: Number(body.posY ?? 0),
      articleId: body.articleId,
      quantity: Number(body.quantity ?? 1),
    },
    include: { article: true },
  });

  return apiSuccess(marker, 201);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const markerId = request.nextUrl.searchParams.get("markerId");
  if (!markerId) return apiError("markerId fehlt", 400);

  const { id: orderId } = await params;

  const marker = await prisma.planMarker.findFirst({
    where: { id: markerId, orderId, order: { tenantId: auth.tenantId } },
  });
  if (!marker) return apiError("Markierung nicht gefunden", 404);

  await prisma.planMarker.delete({ where: { id: markerId } });
  return apiSuccess({ deleted: true });
}
