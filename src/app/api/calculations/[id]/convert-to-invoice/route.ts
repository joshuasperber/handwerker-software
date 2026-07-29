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
import {
  INVOICE_EXISTS_MESSAGE,
  invoiceEditBlockReason,
  isActiveInvoice,
  isInvoiceEditable,
  type InvoiceActionMode,
} from "@/lib/documents/invoice-lifecycle";
import type { Prisma } from "@/generated/prisma/client";
import { parseIssueDateInput, shiftDueDateForIssueChange } from "@/lib/documents/issue-date";

async function findActiveInvoices(
  tenantId: string,
  calculationId: string,
  orderId: string | null
) {
  const byCalc = await prisma.calculationDocument.findMany({
    where: {
      calculationId,
      documentType: "INVOICE",
      status: { not: "STORNIERT" },
      cancelOfId: null,
      calculation: { tenantId },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentNumber: true,
      status: true,
      sentAt: true,
      paidAmount: true,
      canceledAt: true,
      cancelOfId: true,
      documentType: true,
      calculationId: true,
      createdAt: true,
    },
  });

  let byOrder: typeof byCalc = [];
  if (orderId) {
    byOrder = await prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        status: { not: "STORNIERT" },
        cancelOfId: null,
        calculation: { orderId, tenantId },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        documentNumber: true,
        status: true,
        sentAt: true,
        paidAmount: true,
        canceledAt: true,
        cancelOfId: true,
        documentType: true,
        calculationId: true,
        createdAt: true,
      },
    });
  }

  const map = new Map<string, (typeof byCalc)[0]>();
  for (const d of [...byCalc, ...byOrder]) {
    if (isActiveInvoice(d)) map.set(d.id, d);
  }
  return [...map.values()].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime()
  );
}

function serializeInvoiceConflict(doc: Awaited<ReturnType<typeof findActiveInvoices>>[0]) {
  return {
    id: doc.id,
    documentNumber: doc.documentNumber,
    status: doc.status,
    sentAt: doc.sentAt,
    paidAmount: doc.paidAmount,
    editable: isInvoiceEditable(doc),
    blockReason: invoiceEditBlockReason(doc),
    calculationId: doc.calculationId,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const previewOnly = body.preview === true;
  const mode = body.mode as InvoiceActionMode | undefined;
  const documentId = typeof body.documentId === "string" ? body.documentId : undefined;
  const requestedIssueDate = parseIssueDateInput(body.issueDate);

  const loaded = await loadCalculationForDocument(auth.tenantId, id);
  if (!loaded) return apiError("Kalkulation nicht gefunden", 404);

  const rawCalc = await prisma.calculation.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { vatSettings: true },
  });
  const vat = rawCalc?.vatSettings;
  if (
    !previewOnly &&
    (vat?.taxTreatment === "REVERSE_CHARGE" || vat?.reverseCharge) &&
    !vat?.reverseChargeConfirmed
  ) {
    return apiError(
      "Reverse-Charge erfordert eine bewusste Bestätigung in Schritt „Steuer & Ergebnis“.",
      400
    );
  }

  if (previewOnly) {
    const previewNumber = `RE-${new Date().getFullYear()}-VORSCHAU`;
    const html = buildCustomerDocumentHtml("INVOICE", loaded.calc, loaded.company, previewNumber);
    const breakdownHtml = buildInternalBreakdownHtml(loaded.calc, previewNumber);
    return apiSuccess({ html, breakdownHtml, documentNumber: previewNumber });
  }

  const activeInvoices = await findActiveInvoices(auth.tenantId, id, loaded.orderId);
  const primary = activeInvoices[0] ?? null;

  // Ohne bewusste Wahl: bei bestehender Rechnung abbrechen und Optionen anbieten.
  if (!mode && primary) {
    return apiError(INVOICE_EXISTS_MESSAGE, 409, {
      code: "INVOICE_EXISTS",
      invoice: serializeInvoiceConflict(primary),
      invoices: activeInvoices.map(serializeInvoiceConflict),
    });
  }

  const issueDate = requestedIssueDate ?? new Date();
  const terms = loaded.company.paymentTermsDays;
  const dueDate =
    terms != null ? new Date(issueDate.getTime() + terms * 24 * 60 * 60 * 1000) : null;

  if (mode === "update") {
    const target =
      (documentId
        ? activeInvoices.find((d) => d.id === documentId)
        : activeInvoices.find((d) => isInvoiceEditable(d))) ?? null;

    if (!target) {
      return apiError(
        "Keine bearbeitbare Rechnung gefunden. Bitte bewusst eine neue Rechnung oder Korrekturrechnung erstellen.",
        400,
        {
          code: "INVOICE_NOT_EDITABLE",
          invoice: primary ? serializeInvoiceConflict(primary) : null,
          invoices: activeInvoices.map(serializeInvoiceConflict),
        }
      );
    }

    const block = invoiceEditBlockReason(target);
    if (block) {
      return apiError(block, 400, {
        code: "INVOICE_NOT_EDITABLE",
        invoice: serializeInvoiceConflict(target),
        invoices: activeInvoices.map(serializeInvoiceConflict),
      });
    }

    const full = await prisma.calculationDocument.findFirst({
      where: { id: target.id, calculation: { tenantId: auth.tenantId } },
    });
    if (!full) return apiError("Rechnung nicht gefunden", 404);

    const effectiveIssue = requestedIssueDate ?? full.issueDate;
    const issueChanged =
      effectiveIssue.getFullYear() !== full.issueDate.getFullYear() ||
      effectiveIssue.getMonth() !== full.issueDate.getMonth() ||
      effectiveIssue.getDate() !== full.issueDate.getDate();
    const nextDue = issueChanged
      ? shiftDueDateForIssueChange(full.issueDate, effectiveIssue, full.dueDate) ?? dueDate
      : full.dueDate ?? dueDate;

    const snapshot = buildDocumentSnapshot(
      "INVOICE",
      loaded.calc,
      loaded.company,
      full.documentNumber,
      effectiveIssue
    );

    const doc = await prisma.calculationDocument.update({
      where: { id: full.id },
      data: {
        issueDate: effectiveIssue,
        dueDate: nextDue,
        netAmount: loaded.calc.netSalesPrice,
        vatAmount: loaded.calc.vatAmount,
        grossAmount: loaded.calc.grossSalesPrice,
        dataSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        internalNote: `Aktualisiert · Netto ${loaded.calc.netSalesPrice} · Brutto ${loaded.calc.grossSalesPrice}`,
        pdfStorageKey: null,
        eInvoiceStorageKey: null,
        eInvoiceFormat: null,
      },
    });

    await createAuditLog({
      tenantId: auth.tenantId,
      userId: auth.id,
      entityType: "CalculationDocument",
      entityId: doc.id,
      action: issueChanged ? "INVOICE_UPDATED_WITH_ISSUE_DATE" : "INVOICE_UPDATED",
      oldValues: issueChanged
        ? { issueDate: full.issueDate.toISOString() }
        : null,
      newValues: {
        documentNumber: doc.documentNumber,
        grossAmount: doc.grossAmount,
        mode: "update",
        issueDate: doc.issueDate.toISOString(),
      },
      ipAddress: getClientIp(request),
    });

    const html = renderSnapshotHtml(snapshot);
    const breakdownHtml = buildInternalBreakdownHtml(loaded.calc, doc.documentNumber);

    return apiSuccess({
      document: doc,
      html,
      breakdownHtml,
      orderUpdated: false,
      action: "updated" as const,
    });
  }

  // create | correction | erste Rechnung ohne mode (bereits oben abgefangen wenn vorhanden)
  if (mode === "create" || mode === "correction" || (!mode && !primary)) {
    const { doc, snapshot } = await prisma.$transaction(async (tx) => {
      const docNumber = await nextDocumentNumberTx(tx, auth.tenantId, "INVOICE", issueDate);
      const snapshot = buildDocumentSnapshot(
        "INVOICE",
        loaded.calc,
        loaded.company,
        docNumber,
        issueDate
      );

      const notePrefix =
        mode === "correction" && primary
          ? `Korrekturrechnung zu ${primary.documentNumber} · `
          : "";

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
          internalNote: `${notePrefix}Netto ${loaded.calc.netSalesPrice} · Brutto ${loaded.calc.grossSalesPrice}`,
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
      action: mode === "correction" ? "INVOICE_CORRECTION_CREATED" : "INVOICE_CREATED",
      newValues: {
        documentNumber: doc.documentNumber,
        grossAmount: doc.grossAmount,
        mode: mode ?? "create",
        issueDate: doc.issueDate.toISOString(),
        replacesDocumentId: mode === "correction" ? primary?.id : undefined,
      },
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
        action: mode === "correction" ? ("correction" as const) : ("created" as const),
      },
      201
    );
  }

  return apiError("Ungültiger Rechnungsmodus. Bitte update, create oder correction wählen.", 400);
}
