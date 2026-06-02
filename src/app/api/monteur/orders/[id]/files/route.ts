import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { uploadFile } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const category = (formData.get("category") as string) ?? "KUNDENFOTO";
  if (!file) return apiError("Keine Datei", 400);

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
