import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { toDocumentListItem } from "@/lib/documents/document-view";
import { renderSnapshotHtml, type DocumentSnapshot } from "@/lib/documents/snapshot";

async function loadDoc(tenantId: string, id: string) {
  return prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId } },
    include: {
      calculation: {
        select: {
          id: true,
          title: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
      payments: { orderBy: { paidAt: "desc" } },
      dunningNotices: { orderBy: { level: "asc" } },
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
  const doc = await loadDoc(auth.tenantId, id);
  if (!doc) return apiError("Dokument nicht gefunden", 404);

  const { searchParams } = new URL(request.url);
  const snapshot = doc.dataSnapshotJson as unknown as DocumentSnapshot | null;
  const html = snapshot ? renderSnapshotHtml(snapshot) : null;

  // Direkte HTML-Ausgabe (Druck/Iframe)
  if (searchParams.get("format") === "html") {
    if (!html) return apiError("Kein Snapshot vorhanden", 404);
    return new Response(html, {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }

  return apiSuccess({
    document: toDocumentListItem(doc),
    html,
    payments: doc.payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      paidAt: p.paidAt.toISOString(),
      method: p.method,
      note: p.note,
    })),
    dunningNotices: doc.dunningNotices.map((d) => ({
      id: d.id,
      level: d.level,
      feeAmount: d.feeAmount,
      dueDate: d.dueDate?.toISOString() ?? null,
      sentAt: d.sentAt?.toISOString() ?? null,
      note: d.note,
    })),
  });
}
