import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { uploadFile, getSignedDownloadUrl, isStorageConfigured } from "@/lib/storage";
import { validateUpload } from "@/lib/files";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!expense) return apiError("Ausgabe nicht gefunden", 404);

  if (!isStorageConfigured()) {
    return apiError("Datei-Speicher nicht konfiguriert", 503);
  }

  const formData = await request.formData();
  const file = formData.get("receipt");
  if (!(file instanceof File) || file.size === 0) {
    return apiError("Keine Datei hochgeladen");
  }

  const validation = validateUpload(file.type, file.size);
  if (!validation.ok) return apiError(validation.error);

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadFile(buffer, file.name, file.type, "expense-receipts");

  await prisma.expense.update({
    where: { id },
    data: {
      receiptFileName: file.name,
      receiptMimeType: file.type,
      receiptStorageKey: uploaded.key,
      receiptSizeBytes: file.size,
    },
  });

  return apiSuccess({ uploaded: true, fileName: file.name });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { receiptStorageKey: true, receiptFileName: true, receiptMimeType: true },
  });
  if (!expense?.receiptStorageKey) {
    return apiError("Kein Beleg vorhanden", 404);
  }

  const url = await getSignedDownloadUrl(expense.receiptStorageKey);
  return apiSuccess({
    url,
    fileName: expense.receiptFileName,
    mimeType: expense.receiptMimeType,
  });
}
