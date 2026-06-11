import { prisma } from "@/lib/prisma";
import type { Prisma, CalculationDocumentType } from "@/generated/prisma/client";

const PREFIX: Record<CalculationDocumentType, string> = {
  OFFER: "ANG",
  ORDER_CONFIRMATION: "AB",
  INVOICE: "RE",
};

/**
 * Liefert die nächste lückenlose, tenant-weite Belegnummer für das Jahr und den
 * Dokumenttyp. Muss innerhalb einer Transaktion aufgerufen werden, damit das
 * Hochzählen atomar mit der Belegerstellung passiert (GoBD: fortlaufend, eindeutig).
 */
export async function nextDocumentNumberTx(
  tx: Prisma.TransactionClient,
  tenantId: string,
  type: CalculationDocumentType,
  date = new Date()
): Promise<string> {
  const year = date.getFullYear();

  const seq = await tx.documentSequence.upsert({
    where: { tenantId_year_type: { tenantId, year, type } },
    create: { tenantId, year, type, lastNumber: 1 },
    update: { lastNumber: { increment: 1 } },
  });

  return `${PREFIX[type]}-${year}-${String(seq.lastNumber).padStart(4, "0")}`;
}

/** Bequeme Variante außerhalb einer bestehenden Transaktion. */
export async function nextDocumentNumber(
  tenantId: string,
  type: CalculationDocumentType,
  date = new Date()
): Promise<string> {
  return prisma.$transaction((tx) => nextDocumentNumberTx(tx, tenantId, type, date));
}
