import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api";
import type { DocumentSnapshot } from "@/lib/documents/snapshot";
import {
  buildEInvoiceFile,
  resolveEInvoiceFormat,
  validateForEInvoice,
} from "@/lib/documents/einvoice";
import { uploadFile, isStorageConfigured } from "@/lib/storage";

/**
 * GET ?mode=check – Vorschau / Validierung (keine Datei)
 * GET ?mode=download&format=xrechnung|zugferd&confirm=1 – Datei erzeugen
 *
 * Ohne confirm=1 wird keine E-Rechnung erzeugt (bestehende Rechnungen bleiben unverändert).
 * Es wird keine E-Mail versendet.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "check";
  const format = resolveEInvoiceFormat(url.searchParams.get("format"));
  const confirm = url.searchParams.get("confirm") === "1";

  const doc = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
  });
  if (!doc) return apiError("Dokument nicht gefunden", 404);

  const snapshot = doc.dataSnapshotJson as unknown as DocumentSnapshot | null;
  if (!snapshot) return apiError("Kein Snapshot vorhanden", 400);

  const readiness = validateForEInvoice(snapshot);

  if (mode === "check" || mode === "preview") {
    return apiSuccess({
      ...readiness,
      documentId: doc.id,
      existingFormat: doc.eInvoiceFormat,
      existingGeneratedAt: doc.eInvoiceGeneratedAt,
      requestedFormat: format,
      autoEmail: false,
    });
  }

  if (mode !== "download") {
    return apiError("Ungültiger mode. Erlaubt: check | download", 400);
  }

  if (!confirm) {
    return apiError(
      "Bitte E-Rechnung erst prüfen und mit confirm=1 bestätigen. Es erfolgt kein automatischer Versand.",
      400
    );
  }

  if (!readiness.valid) {
    return apiError(`E-Rechnung nicht möglich: ${readiness.errors.join("; ")}`, 400);
  }

  try {
    const file = await buildEInvoiceFile(snapshot, format);

    let storageKey = doc.eInvoiceStorageKey;
    if (isStorageConfigured()) {
      try {
        const uploaded = await uploadFile(
          Buffer.from(file.bytes),
          file.fileName,
          file.mimeType,
          "documents"
        );
        storageKey = uploaded.key;
      } catch {
        // Speicherung optional
      }
    }

    await prisma.calculationDocument.update({
      where: { id: doc.id },
      data: {
        eInvoiceFormat: file.storageLabel,
        eInvoiceStorageKey: storageKey,
        eInvoiceGeneratedAt: new Date(),
      },
    });

    return new Response(Buffer.from(file.bytes), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "X-E-Invoice-Format": file.storageLabel,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "E-Rechnung fehlgeschlagen";
    return apiError(message, 400);
  }
}
