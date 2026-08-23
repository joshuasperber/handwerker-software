import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api";
import { buildDocumentPdf } from "@/lib/documents/build-document-pdf";
import { loadCalculationForDocument } from "@/lib/documents/load-calculation-document";
import {
  snapshotWithCurrentCompany,
  type DocumentSnapshot,
} from "@/lib/documents/snapshot";
import { uploadFile, isStorageConfigured } from "@/lib/storage";

function parseSource(value: string | null): "snapshot" | "current" {
  return value === "current" ? "current" : "snapshot";
}

async function resolveSnapshot(
  tenantId: string,
  doc: { calculationId: string; dataSnapshotJson: unknown },
  source: "snapshot" | "current"
): Promise<DocumentSnapshot | null> {
  const snapshot = doc.dataSnapshotJson as unknown as DocumentSnapshot | null;
  if (!snapshot) return null;
  if (source !== "current") return snapshot;

  const loaded = await loadCalculationForDocument(tenantId, doc.calculationId);
  if (!loaded) return snapshot;
  return snapshotWithCurrentCompany(snapshot, loaded.company);
}

async function maybeStorePdf(
  doc: { id: string; documentNumber: string; pdfStorageKey: string | null },
  bytes: Uint8Array,
  force: boolean
) {
  if (!isStorageConfigured()) return;
  if (!force && doc.pdfStorageKey) return;
  try {
    const { key } = await uploadFile(
      Buffer.from(bytes),
      `${doc.documentNumber}.pdf`,
      "application/pdf",
      "documents"
    );
    await prisma.calculationDocument.update({
      where: { id: doc.id },
      data: { pdfStorageKey: key },
    });
  } catch {
    // Speicherung optional – Download funktioniert trotzdem.
  }
}

function pdfResponse(bytes: Uint8Array, filename: string, download: boolean) {
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Document-Filename": filename,
    },
  });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "1";
  const save = searchParams.get("save") === "1";
  const source = parseSource(searchParams.get("source"));

  const doc = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
  });
  if (!doc) return apiError("Dokument nicht gefunden", 404);

  const snapshot = await resolveSnapshot(auth.tenantId, doc, source);
  if (!snapshot) return apiError("Kein Snapshot vorhanden – PDF nicht möglich", 400);

  const bytes = await buildDocumentPdf(snapshot);
  await maybeStorePdf(doc, bytes, save);

  return pdfResponse(bytes, `${doc.documentNumber}.pdf`, download);
}

/** PDF neu erzeugen und optional in den Speicher legen. Versendet keine E-Mail. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const source = parseSource(typeof body.source === "string" ? body.source : null);
  const save = body.save === true;

  const doc = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
  });
  if (!doc) return apiError("Dokument nicht gefunden", 404);

  const snapshot = await resolveSnapshot(auth.tenantId, doc, source);
  if (!snapshot) return apiError("Kein Snapshot vorhanden – PDF nicht möglich", 400);

  const bytes = await buildDocumentPdf(snapshot);
  await maybeStorePdf(doc, bytes, save);

  return apiSuccess({
    saved: save,
    source,
    filename: `${doc.documentNumber}.pdf`,
    emailed: false,
  });
}
