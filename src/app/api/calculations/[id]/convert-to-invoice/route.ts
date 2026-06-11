import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import {
  buildCustomerDocumentHtml,
  buildInternalBreakdownHtml,
} from "@/lib/documents/build-document-html";
import { loadCalculationForDocument } from "@/lib/documents/load-calculation-document";
import { nextDocumentNumberTx } from "@/lib/documents/sequence";
import { buildDocumentSnapshot, renderSnapshotHtml } from "@/lib/documents/snapshot";
import { createAuditLog } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma/client";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const previewOnly = body.preview === true;

  const loaded = await loadCalculationForDocument(auth.tenantId, id);
  if (!loaded) return apiError("Kalkulation nicht gefunden", 404);

  // Vorschau: keine Nummer vergeben, kein Beleg anlegen.
  if (previewOnly) {
    const previewNumber = `RE-${new Date().getFullYear()}-VORSCHAU`;
    const html = buildCustomerDocumentHtml("INVOICE", loaded.calc, loaded.company, previewNumber);
    const breakdownHtml = buildInternalBreakdownHtml(loaded.calc, previewNumber);
    return apiSuccess({ html, breakdownHtml, documentNumber: previewNumber });
  }

  const issueDate = new Date();
  const terms = loaded.company.paymentTermsDays;
  const dueDate =
    terms != null ? new Date(issueDate.getTime() + terms * 24 * 60 * 60 * 1000) : null;

  const { doc, snapshot } = await prisma.$transaction(async (tx) => {
    const docNumber = await nextDocumentNumberTx(tx, auth.tenantId, "INVOICE", issueDate);
    const snapshot = buildDocumentSnapshot(
      "INVOICE",
      loaded.calc,
      loaded.company,
      docNumber,
      issueDate
    );

    const doc = await tx.calculationDocument.create({
      data: {
        calculationId: id,
        documentType: "INVOICE",
        documentNumber: docNumber,
        status: "OFFEN",
        issueDate,
        dueDate,
        netAmount: loaded.calc.netSalesPrice,
        vatAmount: loaded.calc.vatAmount,
        grossAmount: loaded.calc.grossSalesPrice,
        dataSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        internalNote: `Netto ${loaded.calc.netSalesPrice} · Brutto ${loaded.calc.grossSalesPrice}`,
      },
    });

    await tx.calculation.update({
      where: { id },
      data: { status: "INVOICE_CREATED" },
    });

    if (loaded.orderId) {
      await tx.order.update({
        where: { id: loaded.orderId },
        data: { status: "ABGERECHNET", invoicedAt: issueDate },
      });
    }

    return { doc, snapshot };
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "CalculationDocument",
    entityId: doc.id,
    action: "INVOICE_CREATED",
    newValues: { documentNumber: doc.documentNumber, grossAmount: doc.grossAmount },
    ipAddress: getClientIp(request),
  });

  const html = renderSnapshotHtml(snapshot);
  const breakdownHtml = buildInternalBreakdownHtml(loaded.calc, doc.documentNumber);

  return apiSuccess(
    {
      document: doc,
      html,
      breakdownHtml,
      orderUpdated: !!loaded.orderId,
    },
    201
  );
}
