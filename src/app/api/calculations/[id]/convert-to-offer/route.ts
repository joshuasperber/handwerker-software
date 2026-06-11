import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
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
  const loaded = await loadCalculationForDocument(auth.tenantId, id);
  if (!loaded) return apiError("Kalkulation nicht gefunden", 404);

  const issueDate = new Date();

  const { doc, snapshot } = await prisma.$transaction(async (tx) => {
    const docNumber = await nextDocumentNumberTx(tx, auth.tenantId, "OFFER", issueDate);
    const snapshot = buildDocumentSnapshot(
      "OFFER",
      loaded.calc,
      loaded.company,
      docNumber,
      issueDate
    );

    const doc = await tx.calculationDocument.create({
      data: {
        calculationId: id,
        documentType: "OFFER",
        documentNumber: docNumber,
        status: "OFFEN",
        issueDate,
        netAmount: loaded.calc.netSalesPrice,
        vatAmount: loaded.calc.vatAmount,
        grossAmount: loaded.calc.grossSalesPrice,
        dataSnapshotJson: snapshot as unknown as Prisma.InputJsonValue,
        internalNote: `Netto ${loaded.calc.netSalesPrice} · Brutto ${loaded.calc.grossSalesPrice}`,
      },
    });

    await tx.calculation.update({
      where: { id },
      data: { status: "OFFER_CREATED" },
    });

    return { doc, snapshot };
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "CalculationDocument",
    entityId: doc.id,
    action: "OFFER_CREATED",
    newValues: { documentNumber: doc.documentNumber, grossAmount: doc.grossAmount },
    ipAddress: getClientIp(request),
  });

  return apiSuccess({ document: doc, html: renderSnapshotHtml(snapshot) }, 201);
}
