import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { toDocumentListItem } from "@/lib/documents/document-view";
import type { Prisma } from "@/generated/prisma/client";

import { parseLocalDateInput } from "@/lib/finance/period";

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
      orderId: true,
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
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const openOnly = searchParams.get("open") === "1";
  const overdueOnly = searchParams.get("overdue") === "1";

  const issueDateFilter: Prisma.DateTimeFilter | undefined =
    fromParam || toParam
      ? {
          ...(fromParam ? { gte: parseLocalDateInput(fromParam) } : {}),
          ...(toParam
            ? {
                lte: (() => {
                  const to = parseLocalDateInput(toParam);
                  return new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
                })(),
              }
            : {}),
        }
      : undefined;

  const docs = await prisma.calculationDocument.findMany({
    where: {
      calculation: { tenantId: auth.tenantId },
      ...(type ? { documentType: type as Prisma.EnumCalculationDocumentTypeFilter } : {}),
      ...(status ? { status: status as Prisma.EnumDocumentStatusFilter } : {}),
      ...(issueDateFilter ? { issueDate: issueDateFilter } : {}),
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
  let items = docs.map((d) => toDocumentListItem(d, now));

  if (overdueOnly) {
    items = items.filter((i) => i.documentType === "INVOICE" && i.overdue);
  } else if (openOnly) {
    items = items.filter(
      (i) => i.documentType === "INVOICE" && i.status !== "STORNIERT" && i.openAmount > 0
    );
  }

  const invoices = items.filter((i) => i.documentType === "INVOICE" && i.status !== "STORNIERT");
  const summary = {
    count: items.length,
    openSum: invoices.reduce((s, i) => s + i.openAmount, 0),
    overdueSum: invoices.filter((i) => i.overdue).reduce((s, i) => s + i.openAmount, 0),
    overdueCount: invoices.filter((i) => i.overdue).length,
    revenueOpenCount: invoices.filter((i) => i.openAmount > 0).length,
    vatSum: invoices.reduce((s, i) => s + i.vatAmount, 0),
    netSum: invoices.reduce((s, i) => s + i.netAmount, 0),
    grossSum: invoices.reduce((s, i) => s + i.grossAmount, 0),
  };

  return apiSuccess({ items, summary });
}
