import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { nextDocumentNumberTx } from "@/lib/documents/sequence";
import { renderSnapshotHtml, type DocumentSnapshot } from "@/lib/documents/snapshot";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";

/** Erzeugt aus dem Original-Snapshot einen Storno-Snapshot mit negierten Beträgen. */
function buildStornoSnapshot(
  original: DocumentSnapshot,
  stornoNumber: string,
  issueDate: Date
): DocumentSnapshot {
  const calc = original.calc;
  const neg = (n: number) => -n;
  return {
    ...original,
    documentNumber: stornoNumber,
    issueDateISO: issueDate.toISOString(),
    amounts: {
      net: neg(original.amounts.net),
      vat: neg(original.amounts.vat),
      gross: neg(original.amounts.gross),
    },
    calc: {
      ...calc,
      title: `Stornorechnung zu ${original.documentNumber}`,
      netSalesPrice: neg(calc.netSalesPrice),
      vatAmount: neg(calc.vatAmount),
      grossSalesPrice: neg(calc.grossSalesPrice),
      laborTotal: neg(calc.laborTotal),
      materialTotal: neg(calc.materialTotal),
      machineTotal: neg(calc.machineTotal),
      procurementTotal: neg(calc.procurementTotal),
      travelTotal: neg(calc.travelTotal),
      additionalTotal: neg(calc.additionalTotal),
      directCosts: neg(calc.directCosts),
      overheadAmount: neg(calc.overheadAmount),
      riskAmount: neg(calc.riskAmount),
      profitAmount: neg(calc.profitAmount),
      laborItems: calc.laborItems.map((i) => ({ ...i, totalNet: neg(i.totalNet) })),
      materialItems: calc.materialItems.map((i) => ({
        ...i,
        totalSalesNet: neg(i.totalSalesNet),
      })),
      travelCost: calc.travelCost
        ? { ...calc.travelCost, totalNet: neg(calc.travelCost.totalNet) }
        : null,
    },
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const reason: string = (body.reason ?? "").toString().trim() || "Storniert";

  const original = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
  });
  if (!original) return apiError("Dokument nicht gefunden", 404);
  if (original.documentType !== "INVOICE")
    return apiError("Nur Rechnungen können storniert werden", 400);
  if (original.status === "STORNIERT")
    return apiError("Dokument ist bereits storniert", 400);

  const snapshot = original.dataSnapshotJson as unknown as DocumentSnapshot | null;
  if (!snapshot) return apiError("Kein Snapshot vorhanden – Storno nicht möglich", 400);

  const issueDate = new Date();

  const { storno } = await prisma.$transaction(async (tx) => {
    const stornoNumber = await nextDocumentNumberTx(tx, auth.tenantId, "INVOICE", issueDate);
    const stornoSnap = buildStornoSnapshot(snapshot, stornoNumber, issueDate);

    const storno = await tx.calculationDocument.create({
      data: {
        calculationId: original.calculationId,
        documentType: "INVOICE",
        documentNumber: stornoNumber,
        status: "STORNIERT",
        issueDate,
        netAmount: -original.netAmount,
        vatAmount: -original.vatAmount,
        grossAmount: -original.grossAmount,
        cancelOfId: original.id,
        cancelReason: reason,
        canceledAt: issueDate,
        dataSnapshotJson: stornoSnap as unknown as Prisma.InputJsonValue,
        internalNote: `Storno zu ${original.documentNumber}`,
      },
    });

    await tx.calculationDocument.update({
      where: { id: original.id },
      data: { status: "STORNIERT", canceledAt: issueDate, cancelReason: reason },
    });

    return { storno };
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "CalculationDocument",
    entityId: original.id,
    action: "INVOICE_CANCELLED",
    oldValues: { status: original.status },
    newValues: { status: "STORNIERT", stornoDocumentId: storno.id, reason },
    ipAddress: getClientIp(request),
  });

  return apiSuccess(
    { storno: { id: storno.id, documentNumber: storno.documentNumber }, html: renderSnapshotHtml(snapshot) },
    201
  );
}
