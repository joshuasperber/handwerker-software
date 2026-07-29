import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { toDocumentListItem } from "@/lib/documents/document-view";
import {
  renderSnapshotHtml,
  type DocumentSnapshot,
} from "@/lib/documents/snapshot";
import { createAuditLog } from "@/lib/audit";
import {
  canChangeInvoiceIssueDate,
  issueDateChangeNeedsConfirmation,
  ISSUE_DATE_CHANGE_WARNING,
} from "@/lib/documents/invoice-lifecycle";
import {
  parseIssueDateInput,
  shiftDueDateForIssueChange,
} from "@/lib/documents/issue-date";
import type { Prisma } from "@/generated/prisma/client";

async function loadDoc(tenantId: string, id: string) {
  return prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId } },
    include: {
      calculation: {
        select: {
          id: true,
          title: true,
          orderId: true,
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

/**
 * Rechnungsdatum nachträglich ändern.
 * Body: { issueDate: "YYYY-MM-DD", confirmIssueDateChange?: boolean }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const issueDate = parseIssueDateInput(body.issueDate);
  if (!issueDate) {
    return apiError("Ungültiges Rechnungsdatum", 400);
  }

  const doc = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
  });
  if (!doc) return apiError("Dokument nicht gefunden", 404);

  if (doc.documentType !== "INVOICE") {
    return apiError("Nur bei Rechnungen kann das Rechnungsdatum geändert werden", 400);
  }

  if (!canChangeInvoiceIssueDate(doc)) {
    return apiError("Stornierte Rechnungen können nicht geändert werden", 400);
  }

  const needsConfirm = issueDateChangeNeedsConfirmation(doc);
  if (needsConfirm && body.confirmIssueDateChange !== true) {
    return apiError(ISSUE_DATE_CHANGE_WARNING, 409, {
      code: "ISSUE_DATE_CONFIRM_REQUIRED",
      warning: ISSUE_DATE_CHANGE_WARNING,
    });
  }

  const oldIssue = doc.issueDate;
  const sameDay =
    oldIssue.getFullYear() === issueDate.getFullYear() &&
    oldIssue.getMonth() === issueDate.getMonth() &&
    oldIssue.getDate() === issueDate.getDate();
  if (sameDay) {
    const full = await loadDoc(auth.tenantId, id);
    if (!full) return apiError("Dokument nicht gefunden", 404);
    return apiSuccess({ document: toDocumentListItem(full), unchanged: true });
  }

  const newDue = shiftDueDateForIssueChange(oldIssue, issueDate, doc.dueDate);
  const snapshot = doc.dataSnapshotJson as DocumentSnapshot | null;
  let nextSnapshot: DocumentSnapshot | null = snapshot;
  if (snapshot && typeof snapshot === "object") {
    nextSnapshot = {
      ...snapshot,
      issueDateISO: issueDate.toISOString(),
    };
  }

  const updated = await prisma.calculationDocument.update({
    where: { id: doc.id },
    data: {
      issueDate,
      ...(newDue ? { dueDate: newDue } : {}),
      ...(nextSnapshot
        ? { dataSnapshotJson: nextSnapshot as unknown as Prisma.InputJsonValue }
        : {}),
      pdfStorageKey: null,
      eInvoiceStorageKey: null,
      eInvoiceFormat: null,
    },
    include: {
      calculation: {
        select: {
          id: true,
          title: true,
          orderId: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "CalculationDocument",
    entityId: updated.id,
    action: "INVOICE_ISSUE_DATE_CHANGED",
    oldValues: {
      issueDate: oldIssue.toISOString(),
      dueDate: doc.dueDate?.toISOString() ?? null,
    },
    newValues: {
      issueDate: issueDate.toISOString(),
      dueDate: updated.dueDate?.toISOString() ?? null,
      confirmed: needsConfirm,
      documentNumber: updated.documentNumber,
    },
    ipAddress: getClientIp(request),
  });

  return apiSuccess({
    document: toDocumentListItem(updated),
    warningAcknowledged: needsConfirm,
  });
}
