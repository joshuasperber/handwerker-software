import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { toTenantLogoSrc } from "@/lib/logo";
import { ImageStoreError, storeUploadedImage } from "@/lib/store-uploaded-image";
import { storedImageKey } from "@/lib/stored-image";
import { storedImageResponse } from "@/lib/stored-image-server";
import { deleteFile } from "@/lib/storage";

const MAX_LOGO_BYTES = 1_200_000;

async function loadTenant(tenantId: string) {
  return prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { logoUrl: true, updatedAt: true },
  });
}

export async function GET() {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const tenant = await loadTenant(auth.tenantId);
  return storedImageResponse(tenant?.logoUrl ?? null);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return apiError("Ungültige Formulardaten", 400);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return apiError("Keine Bilddatei übermittelt", 400);
  }
  if (!file.type.startsWith("image/")) {
    return apiError("Bitte eine Bilddatei (PNG/JPG/…) wählen", 400);
  }
  if (file.size > MAX_LOGO_BYTES) {
    return apiError("Logo ist zu groß (max. ca. 1,2 MB nach Komprimierung)", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const existing = await loadTenant(auth.tenantId);
  const previousKey = storedImageKey(existing?.logoUrl);

  let stored: string;
  try {
    stored = await storeUploadedImage({
      buffer,
      fileName: file.name || "logo.png",
      mimeType: file.type || "image/png",
      folder: `logos/${auth.tenantId}/tenant`,
    });
  } catch (err) {
    if (err instanceof ImageStoreError) return apiError(err.message, 400);
    console.error("[tenant/settings/logo] upload failed", err);
    return apiError(
      "Logo konnte nicht im Datei-Speicher abgelegt werden. Bitte später erneut versuchen.",
      500
    );
  }

  const updated = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { logoUrl: stored },
    select: { logoUrl: true, updatedAt: true },
  });

  if (previousKey && previousKey !== stored) {
    await deleteFile(previousKey).catch(() => {});
  }

  return apiSuccess({
    logoUrl: toTenantLogoSrc(updated.logoUrl, updated.updatedAt),
    hasLogo: true,
  });
}

export async function DELETE() {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const existing = await loadTenant(auth.tenantId);
  const previousKey = storedImageKey(existing?.logoUrl);

  await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { logoUrl: null },
  });

  if (previousKey) {
    await deleteFile(previousKey).catch(() => {});
  }

  return apiSuccess({ logoUrl: null, hasLogo: false });
}
