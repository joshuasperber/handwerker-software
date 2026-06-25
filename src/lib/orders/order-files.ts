import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";
import {
  uploadFile,
  getSignedDownloadUrl,
  isStorageConfigured,
  StorageUploadError,
} from "@/lib/storage";
import { validateUpload, NON_PHOTO_CATEGORIES } from "@/lib/files";
import type { FileCategory } from "@/generated/prisma/client";

interface UploadOrderFilesInput {
  orderId: string;
  userId: string;
  formData: FormData;
  resolveCategory: (raw: string) => FileCategory;
}

export async function uploadOrderFiles(input: UploadOrderFilesInput) {
  if (!isStorageConfigured()) {
    return apiError(
      "Dateispeicher ist nicht konfiguriert. Bitte den Administrator kontaktieren.",
      503
    );
  }

  const files = input.formData.getAll("file").filter((f): f is File => f instanceof File);
  const rawCategory = (input.formData.get("category") as string) ?? "KUNDENFOTO";
  const category = input.resolveCategory(rawCategory);
  const description =
    ((input.formData.get("description") as string) || "").trim() || null;
  const orderPhaseId = (input.formData.get("orderPhaseId") as string) || null;

  if (files.length === 0) {
    return apiError("Keine Datei hochgeladen", 400);
  }

  if (orderPhaseId) {
    const phase = await prisma.orderPhase.findFirst({
      where: { id: orderPhaseId, orderId: input.orderId },
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
      ({ key } = await uploadFile(
        buffer,
        file.name,
        file.type,
        `orders/${input.orderId}`
      ));
    } catch (err) {
      if (err instanceof StorageUploadError) {
        return apiError(err.message, 502);
      }
      throw err;
    }

    const upload = await prisma.fileUpload.create({
      data: {
        orderId: input.orderId,
        orderPhaseId,
        uploadedById: input.userId,
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

  return created;
}

interface ListOrderPhotoFilesInput {
  orderId: string;
  tenantId?: string;
  phaseFilter?: string | null;
}

export async function listOrderPhotoFiles(input: ListOrderPhotoFilesInput) {
  const files = await prisma.fileUpload.findMany({
    where: {
      orderId: input.orderId,
      ...(input.tenantId ? { order: { tenantId: input.tenantId } } : {}),
      category: { notIn: NON_PHOTO_CATEGORIES },
      ...(input.phaseFilter ? { orderPhaseId: input.phaseFilter } : {}),
    },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return Promise.all(
    files.map(async (file) => ({
      ...file,
      url: await getSignedDownloadUrl(file.storageKey).catch(() => null),
    }))
  );
}
