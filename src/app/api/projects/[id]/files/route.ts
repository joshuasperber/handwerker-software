import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  uploadFile,
  getSignedDownloadUrl,
  isStorageConfigured,
  StorageUploadError,
} from "@/lib/storage";
import { isValidFileCategory, validateUpload, fileCategoryLabel } from "@/lib/files";

async function assertProject(tenantId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, tenantId },
    select: { id: true },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  if (!(await assertProject(auth.tenantId, projectId))) {
    return apiError("Projekt nicht gefunden", 404);
  }

  const files = await prisma.projectFile.findMany({
    where: { projectId },
    include: {
      uploadedBy: { select: { firstName: true, lastName: true } },
      order: { select: { id: true, orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const withUrls = await Promise.all(
    files.map(async (f) => ({
      id: f.id,
      fileName: f.fileName,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      category: f.category,
      categoryLabel: fileCategoryLabel(f.category),
      description: f.description,
      orderId: f.orderId,
      orderNumber: f.order?.orderNumber ?? null,
      createdAt: f.createdAt.toISOString(),
      uploadedBy: f.uploadedBy
        ? `${f.uploadedBy.firstName} ${f.uploadedBy.lastName}`.trim()
        : null,
      url: await getSignedDownloadUrl(f.storageKey).catch(() => null),
    }))
  );

  return apiSuccess(withUrls);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  if (!(await assertProject(auth.tenantId, projectId))) {
    return apiError("Projekt nicht gefunden", 404);
  }

  if (!isStorageConfigured()) {
    return apiError(
      "Dateispeicher ist nicht konfiguriert. Bitte den Administrator kontaktieren.",
      503
    );
  }

  const formData = await request.formData();
  const files = formData.getAll("file").filter((f): f is File => f instanceof File);
  const rawCategory = (formData.get("category") as string) ?? "BAUSTELLE";
  const category = isValidFileCategory(rawCategory) ? rawCategory : "BAUSTELLE";
  const description = ((formData.get("description") as string) || "").trim() || null;
  const orderId = ((formData.get("orderId") as string) || "").trim() || null;

  if (files.length === 0) return apiError("Keine Datei hochgeladen");

  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!order) return apiError("Auftrag nicht gefunden", 404);
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
        `projects/${projectId}`
      ));
    } catch (err) {
      if (err instanceof StorageUploadError) {
        return apiError(err.message, 502);
      }
      throw err;
    }

    const upload = await prisma.projectFile.create({
      data: {
        projectId,
        orderId,
        uploadedById: auth.id,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: buffer.length,
        storageKey: key,
        category,
        description,
      },
      include: {
        uploadedBy: { select: { firstName: true, lastName: true } },
        order: { select: { id: true, orderNumber: true } },
      },
    });

    created.push({
      id: upload.id,
      fileName: upload.fileName,
      mimeType: upload.mimeType,
      sizeBytes: upload.sizeBytes,
      category: upload.category,
      categoryLabel: fileCategoryLabel(upload.category),
      description: upload.description,
      orderId: upload.orderId,
      orderNumber: upload.order?.orderNumber ?? null,
      createdAt: upload.createdAt.toISOString(),
      uploadedBy: upload.uploadedBy
        ? `${upload.uploadedBy.firstName} ${upload.uploadedBy.lastName}`.trim()
        : null,
      url: await getSignedDownloadUrl(upload.storageKey).catch(() => null),
    });
  }

  return apiSuccess(created, 201);
}
