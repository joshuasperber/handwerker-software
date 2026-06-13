import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";
import {
  uploadFile,
  getSignedDownloadUrl,
  isStorageConfigured,
  StorageUploadError,
} from "@/lib/storage";
import { validateUpload, isValidPhotoCategory, NON_PHOTO_CATEGORIES } from "@/lib/files";
import type { FileCategory } from "@/generated/prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  if (!isStorageConfigured()) {
    return apiError("Dateispeicher ist nicht konfiguriert. Bitte den Administrator kontaktieren.", 503);
  }

  const formData = await request.formData();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  const rawCategory = (formData.get("category") as string) ?? "KUNDENFOTO";
  const category: FileCategory = isValidPhotoCategory(rawCategory)
    ? rawCategory
    : "KUNDENFOTO";
  const description = ((formData.get("description") as string) || "").trim() || null;
  const orderPhaseId = (formData.get("orderPhaseId") as string) || null;

  if (files.length === 0) return apiError("Keine Datei", 400);

  if (orderPhaseId) {
    const phase = await prisma.orderPhase.findFirst({
      where: { id: orderPhaseId, orderId },
      select: { id: true },
    });
    if (!phase) return apiError("Phase nicht gefunden", 404);
  }

  const created = [];
  for (const file of files) {
    const buffer = Buffer.from(await file.arrayBuffer());
    const validation = validateUpload(file.type, buffer.length);
    if (!validation.ok) {
      return apiError(`${file.name}: ${validation.error}`, 400);
    }

    let key: string;
    try {
      ({ key } = await uploadFile(buffer, file.name, file.type, `orders/${orderId}`));
    } catch (err) {
      if (err instanceof StorageUploadError) {
        return apiError(err.message, 502);
      }
      throw err;
    }
    const upload = await prisma.fileUpload.create({
      data: {
        orderId,
        orderPhaseId,
        uploadedById: auth.id,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: buffer.length,
        storageKey: key,
        category,
        description,
      },
    });
    created.push(upload);
  }

  return apiSuccess(created, 201);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  const { searchParams } = new URL(request.url);
  const phaseFilter = searchParams.get("orderPhaseId");

  const files = await prisma.fileUpload.findMany({
    where: {
      orderId,
      category: { notIn: NON_PHOTO_CATEGORIES },
      ...(phaseFilter ? { orderPhaseId: phaseFilter } : {}),
    },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const withUrls = await Promise.all(
    files.map(async (f) => ({
      ...f,
      url: await getSignedDownloadUrl(f.storageKey).catch(() => null),
    }))
  );

  return apiSuccess(withUrls);
}
