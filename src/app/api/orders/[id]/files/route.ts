import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { uploadFile } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;

  const order = await prisma.order.findFirst({
    where: { id: orderId, tenantId: auth.tenantId },
  });

  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string) ?? "KUNDENFOTO";

  if (!file) return apiError("Keine Datei hochgeladen", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const { key } = await uploadFile(buffer, file.name, file.type, `orders/${orderId}`);

  const upload = await prisma.fileUpload.create({
    data: {
      orderId,
      uploadedById: auth.id,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: buffer.length,
      storageKey: key,
      category: category as never,
    },
  });

  return apiSuccess(upload, 201);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;

  const files = await prisma.fileUpload.findMany({
    where: { orderId, order: { tenantId: auth.tenantId } },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(files);
}
