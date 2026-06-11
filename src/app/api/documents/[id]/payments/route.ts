import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { deriveInvoiceStatus } from "@/lib/documents/document-view";
import { createAuditLog } from "@/lib/audit";

const schema = z.object({
  amount: z.number().refine((n) => Math.abs(n) > 0, "Betrag darf nicht 0 sein"),
  paidAt: z.string().optional(),
  method: z
    .enum(["UEBERWEISUNG", "BAR", "KARTE", "LASTSCHRIFT", "PAYPAL", "SONSTIGES"])
    .default("UEBERWEISUNG"),
  note: z.string().trim().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.payments");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", 400);
  }
  const { amount, paidAt, method, note } = parsed.data;

  const doc = await prisma.calculationDocument.findFirst({
    where: { id, calculation: { tenantId: auth.tenantId } },
  });
  if (!doc) return apiError("Dokument nicht gefunden", 404);
  if (doc.documentType !== "INVOICE")
    return apiError("Zahlungen sind nur für Rechnungen möglich", 400);
  if (doc.status === "STORNIERT")
    return apiError("Für stornierte Rechnungen sind keine Zahlungen möglich", 400);

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        tenantId: auth.tenantId,
        documentId: doc.id,
        amount,
        paidAt: paidAt ? new Date(paidAt) : new Date(),
        method,
        note: note || null,
        createdById: auth.id,
      },
    });

    const agg = await tx.payment.aggregate({
      where: { documentId: doc.id },
      _sum: { amount: true },
    });
    const paidAmount = agg._sum.amount ?? 0;
    const status = deriveInvoiceStatus(doc.grossAmount, paidAmount);

    return tx.calculationDocument.update({
      where: { id: doc.id },
      data: {
        paidAmount,
        status,
        paidAt: status === "BEZAHLT" ? new Date() : null,
      },
    });
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "CalculationDocument",
    entityId: doc.id,
    action: "PAYMENT_RECORDED",
    newValues: { amount, method, paidAmount: updated.paidAmount, status: updated.status },
    ipAddress: getClientIp(request),
  });

  return apiSuccess(
    { paidAmount: updated.paidAmount, status: updated.status },
    201
  );
}
