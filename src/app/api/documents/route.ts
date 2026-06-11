import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { toDocumentListItem } from "@/lib/documents/document-view";
import type { Prisma } from "@/generated/prisma/client";

const DOC_SELECT = {
  id: true,
  documentNumber: true,
  documentType: true,
  status: true,
  issueDate: true,
  dueDate: true,
  netAmount: true,
  vatAmount: true,
  grossAmount: true,
  paidAmount: true,
  sentAt: true,
  canceledAt: true,
  cancelOfId: true,
  pdfStorageKey: true,
  eInvoiceFormat: true,
  dataSnapshotJson: true,
  calculation: {
    select: {
      id: true,
      title: true,
      customer: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.CalculationDocumentSelect;

export async function GET(request: Request) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const q = searchParams.get("q")?.trim();

  const docs = await prisma.calculationDocument.findMany({
    where: {
      calculation: { tenantId: auth.tenantId },
      ...(type ? { documentType: type as Prisma.EnumCalculationDocumentTypeFilter } : {}),
      ...(status ? { status: status as Prisma.EnumDocumentStatusFilter } : {}),
      ...(q
        ? {
            OR: [
              { documentNumber: { contains: q, mode: "insensitive" } },
              {
                calculation: {
                  customer: {
                    OR: [
                      { firstName: { contains: q, mode: "insensitive" } },
                      { lastName: { contains: q, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    },
    select: DOC_SELECT,
    orderBy: { issueDate: "desc" },
    take: 500,
  });

  const now = new Date();
  const items = docs.map((d) => toDocumentListItem(d, now));

  const invoices = items.filter((i) => i.documentType === "INVOICE" && i.status !== "STORNIERT");
  const summary = {
    count: items.length,
    openSum: invoices.reduce((s, i) => s + i.openAmount, 0),
    overdueSum: invoices.filter((i) => i.overdue).reduce((s, i) => s + i.openAmount, 0),
    overdueCount: invoices.filter((i) => i.overdue).length,
    revenueOpenCount: invoices.filter((i) => i.openAmount > 0).length,
  };

  return apiSuccess({ items, summary });
}
