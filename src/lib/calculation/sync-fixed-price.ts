import { prisma } from "@/lib/prisma";
import {
  normalizeFixedPriceFields,
  type FixedPriceSourceFields,
} from "@/lib/calculation/fixed-price";

/** Schreibt Festpreis-Felder auf die verknüpfte Kalkulation (falls vorhanden). */
export async function syncFixedPriceToOrderCalculation(
  tenantId: string,
  orderId: string,
  fields: FixedPriceSourceFields
) {
  const calc = await prisma.calculation.findFirst({
    where: { tenantId, orderId },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  if (!calc) return null;

  await prisma.calculation.update({
    where: { id: calc.id },
    data: {
      useFixedPrice: fields.useFixedPrice,
      fixedPriceNet: fields.fixedPriceNet,
      fixedPriceLabel: fields.fixedPriceLabel,
      fixedPriceDisplayMode: fields.fixedPriceDisplayMode,
    },
  });
  return calc.id;
}

/** Spiegelt Festpreis von der Kalkulation zurück auf den Auftrag. */
export async function syncFixedPriceToOrder(
  tenantId: string,
  orderId: string | null | undefined,
  fields: FixedPriceSourceFields
) {
  if (!orderId) return;
  await prisma.order.updateMany({
    where: { id: orderId, tenantId },
    data: {
      useFixedPrice: fields.useFixedPrice,
      fixedPriceNet: fields.fixedPriceNet,
      fixedPriceLabel: fields.fixedPriceLabel,
      fixedPriceDisplayMode: fields.fixedPriceDisplayMode,
    },
  });
}

export function parseFixedPriceBody(
  body: Record<string, unknown>,
  fallbackLabel?: string | null
) {
  return normalizeFixedPriceFields({
    useFixedPrice: body.useFixedPrice as boolean | null | undefined,
    fixedPriceNet:
      body.fixedPriceNet === undefined && body.fixedPriceAmount !== undefined
        ? (body.fixedPriceAmount as number | null)
        : (body.fixedPriceNet as number | null | undefined),
    fixedPriceLabel: body.fixedPriceLabel as string | null | undefined,
    fixedPriceDisplayMode: body.fixedPriceDisplayMode as string | null | undefined,
    fallbackLabel,
  });
}
