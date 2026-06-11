import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId, fileId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  // Monteure dürfen nur ihre eigenen Uploads löschen.
  const file = await prisma.fileUpload.findFirst({
    where: { id: fileId, orderId, uploadedById: auth.id },
    select: { id: true, storageKey: true },
  });

  if (!file) return apiError("Datei nicht gefunden oder kein Zugriff", 404);

  await deleteFile(file.storageKey).catch(() => {});
  await prisma.fileUpload.delete({ where: { id: file.id } });

  return apiSuccess({ id: file.id });
}
