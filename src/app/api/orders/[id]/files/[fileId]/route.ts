import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { deleteFile } from "@/lib/storage";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; fileId: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: orderId, fileId } = await params;

  const file = await prisma.fileUpload.findFirst({
    where: { id: fileId, orderId, order: { tenantId: auth.tenantId } },
    select: { id: true, storageKey: true },
  });

  if (!file) return apiError("Datei nicht gefunden", 404);

  await deleteFile(file.storageKey).catch(() => {
    // Storage-Fehler nicht blockierend behandeln – DB-Eintrag wird trotzdem entfernt.
  });
  await prisma.fileUpload.delete({ where: { id: file.id } });

  return apiSuccess({ id: file.id });
}
