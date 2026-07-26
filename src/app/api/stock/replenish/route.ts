import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { applyStockMovement } from "@/lib/inventory/stock-movements";
import { prisma } from "@/lib/prisma";
import { REPLENISH_REASON } from "@/lib/inventory/reasons";
import { uploadFile, isStorageConfigured } from "@/lib/storage";
import { validateUpload } from "@/lib/files";

async function parseReplenishBody(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const raw = form.get("data");
    const data =
      typeof raw === "string"
        ? (JSON.parse(raw) as Record<string, unknown>)
        : {};
    const receipt = form.get("receipt");
    return { data, receipt: receipt instanceof File ? receipt : null };
  }
  const data = (await request.json()) as Record<string, unknown>;
  return { data, receipt: null as File | null };
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("inventory.write");
  if (auth instanceof Response) return auth;

  let parsed: { data: Record<string, unknown>; receipt: File | null };
  try {
    parsed = await parseReplenishBody(request);
  } catch {
    return apiError("Ungültige Anfrage", 400);
  }

  const {
    articleId,
    storageLocationId,
    quantity,
    purchasePriceNet,
    supplierName,
    notes,
    occurredAt,
    updateArticlePrice,
  } = parsed.data;

  if (!articleId || !storageLocationId || quantity == null) {
    return apiError("Artikel, Lagerort und Menge sind Pflicht", 400);
  }

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) {
    return apiError("Menge muss größer als 0 sein", 400);
  }

  const [article, location] = await Promise.all([
    prisma.article.findFirst({
      where: { id: String(articleId), tenantId: auth.tenantId, isActive: true },
    }),
    prisma.storageLocation.findFirst({
      where: { id: String(storageLocationId), tenantId: auth.tenantId, isActive: true },
    }),
  ]);
  if (!article) return apiError("Artikel nicht gefunden", 404);
  if (!location) return apiError("Lagerort nicht gefunden", 404);

  let receiptFields: {
    receiptFileName?: string;
    receiptMimeType?: string;
    receiptStorageKey?: string;
    receiptSizeBytes?: number;
  } = {};

  if (parsed.receipt && parsed.receipt.size > 0) {
    const validation = validateUpload(parsed.receipt.type, parsed.receipt.size);
    if (!validation.ok) return apiError(validation.error);
    if (!isStorageConfigured()) {
      return apiError("Datei-Speicher nicht konfiguriert — Beleg kann nicht hochgeladen werden", 503);
    }
    const buffer = Buffer.from(await parsed.receipt.arrayBuffer());
    const uploaded = await uploadFile(
      buffer,
      parsed.receipt.name,
      parsed.receipt.type,
      "inventory-receipts"
    );
    receiptFields = {
      receiptFileName: parsed.receipt.name,
      receiptMimeType: parsed.receipt.type,
      receiptStorageKey: uploaded.key,
      receiptSizeBytes: parsed.receipt.size,
    };
  }

  const purchase =
    purchasePriceNet != null && purchasePriceNet !== ""
      ? Number(purchasePriceNet)
      : null;

  const supplier =
    typeof supplierName === "string" && supplierName.trim()
      ? supplierName.trim()
      : article.supplierName;

  try {
    const result = await applyStockMovement({
      tenantId: auth.tenantId,
      articleId: article.id,
      storageLocationId: location.id,
      movementType: "ZUGANG",
      quantity: qty,
      reason: REPLENISH_REASON,
      purchasePriceNet: purchase != null && Number.isFinite(purchase) ? purchase : article.purchasePriceNet,
      supplierName: supplier,
      notes: typeof notes === "string" && notes.trim() ? notes.trim() : null,
      occurredAt: occurredAt ? new Date(String(occurredAt)) : new Date(),
      createdById: auth.id,
      ...receiptFields,
    });

    if (updateArticlePrice && purchase != null && Number.isFinite(purchase)) {
      await prisma.article.update({
        where: { id: article.id },
        data: {
          purchasePriceNet: purchase,
          ...(supplier ? { supplierName: supplier } : {}),
        },
      });
    } else if (supplier && supplier !== article.supplierName) {
      await prisma.article.update({
        where: { id: article.id },
        data: { supplierName: supplier },
      });
    }

    return apiSuccess({
      onHandQuantity: result.onHandQuantity,
      movementId: result.movementId,
      added: qty,
      unit: article.unit,
      message: `Bestand aufgefüllt: +${qty} ${article.unit}. Bestand jetzt ${result.onHandQuantity} ${article.unit}.`,
    });
  } catch (err) {
    return apiError(err instanceof Error ? err.message : "Auffüllen fehlgeschlagen", 400);
  }
}
