import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { toInvoiceLogoSrc } from "@/lib/logo";
import { ImageStoreError, storeUploadedImage } from "@/lib/store-uploaded-image";
import { storedImageKey } from "@/lib/stored-image";
import { storedImageResponse } from "@/lib/stored-image-server";
import { deleteFile } from "@/lib/storage";

const MAX_LOGO_BYTES = 1_200_000;

async function loadCompany(tenantId: string) {
  return prisma.companySettings.findUnique({
    where: { tenantId },
    select: { invoiceLogoUrl: true, updatedAt: true },
  });
}

async function ensureCompany(tenantId: string) {
  const existing = await prisma.companySettings.findUnique({ where: { tenantId } });
  if (existing) return existing;
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true },
  });
  return prisma.companySettings.create({
    data: { tenantId, companyName: tenant?.name ?? "Mein Betrieb" },
  });
}

export async function GET() {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const company = await loadCompany(auth.tenantId);
  return storedImageResponse(company?.invoiceLogoUrl ?? null);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("calculations.settings");
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
  const existing = await loadCompany(auth.tenantId);
  const previousKey = storedImageKey(existing?.invoiceLogoUrl);

  let stored: string;
  try {
    stored = await storeUploadedImage({
      buffer,
      fileName: file.name || "logo.png",
      mimeType: file.type || "image/png",
      folder: `logos/${auth.tenantId}/invoice`,
    });
  } catch (err) {
    if (err instanceof ImageStoreError) return apiError(err.message, 400);
    console.error("[company-settings/logo] upload failed", err);
    return apiError(
      "Logo konnte nicht im Datei-Speicher abgelegt werden. Bitte später erneut versuchen.",
      500
    );
  }

  await ensureCompany(auth.tenantId);
  const updated = await prisma.companySettings.update({
    where: { tenantId: auth.tenantId },
    data: { invoiceLogoUrl: stored },
    select: { invoiceLogoUrl: true, updatedAt: true },
  });

  if (previousKey && previousKey !== stored) {
    await deleteFile(previousKey).catch(() => {});
  }

  return apiSuccess({
    invoiceLogoUrl: toInvoiceLogoSrc(updated.invoiceLogoUrl, updated.updatedAt),
    hasInvoiceLogo: true,
  });
}

export async function DELETE() {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const existing = await loadCompany(auth.tenantId);
  const previousKey = storedImageKey(existing?.invoiceLogoUrl);

  if (existing) {
    await prisma.companySettings.update({
      where: { tenantId: auth.tenantId },
      data: { invoiceLogoUrl: null },
    });
  }

  if (previousKey) {
    await deleteFile(previousKey).catch(() => {});
  }

  return apiSuccess({ invoiceLogoUrl: null, hasInvoiceLogo: false });
}
