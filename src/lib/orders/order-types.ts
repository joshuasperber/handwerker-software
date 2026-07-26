import { prisma } from "@/lib/prisma";
import type { OrderType } from "@/generated/prisma/client";

/** Standard-Auftragstypen (inkl. Legacy-Enum-Mapping). */
export const DEFAULT_ORDER_TYPE_DEFS: {
  name: string;
  legacyKey: OrderType | null;
  isOther?: boolean;
  sortOrder: number;
}[] = [
  { name: "Reparatur", legacyKey: "REPARATUR", sortOrder: 10 },
  { name: "Montage", legacyKey: "MONTAGE", sortOrder: 20 },
  { name: "Tür montieren", legacyKey: null, sortOrder: 30 },
  { name: "Fenster einbauen", legacyKey: null, sortOrder: 40 },
  { name: "Aufmaß", legacyKey: "BESICHTIGUNG", sortOrder: 50 },
  { name: "Lieferung", legacyKey: null, sortOrder: 60 },
  { name: "Wartung", legacyKey: null, sortOrder: 70 },
  { name: "Wohnungssanierung / Renovierung", legacyKey: "RENOVIERUNG", sortOrder: 80 },
  { name: "Innenausbau", legacyKey: "INNENAUSBAU", sortOrder: 90 },
  { name: "Elektroinstallation", legacyKey: "ELEKTRO", sortOrder: 100 },
  { name: "Nacharbeit / Reklamation", legacyKey: "NACHARBEIT", sortOrder: 110 },
  { name: "Notdienst", legacyKey: "NOTDIENST", sortOrder: 120 },
  { name: "Sonstiges", legacyKey: "SONSTIGES", isOther: true, sortOrder: 999 },
];

export { formatOrderTypeLabel } from "@/lib/orders/order-type-label";

/**
 * Legt Standard-Typen an, falls der Tenant noch keine hat,
 * und verknüpft bestehende Aufträge per Legacy-Enum.
 */
export async function ensureOrderTypeDefinitions(tenantId: string) {
  const existing = await prisma.orderTypeDefinition.count({ where: { tenantId } });
  if (existing === 0) {
    await prisma.orderTypeDefinition.createMany({
      data: DEFAULT_ORDER_TYPE_DEFS.map((d) => ({
        tenantId,
        name: d.name,
        legacyKey: d.legacyKey,
        isOther: d.isOther ?? false,
        sortOrder: d.sortOrder,
        isActive: true,
      })),
    });
  } else {
    // Sicherstellen, dass „Sonstiges“ existiert
    const other = await prisma.orderTypeDefinition.findFirst({
      where: { tenantId, isOther: true },
    });
    if (!other) {
      const maxSort = await prisma.orderTypeDefinition.aggregate({
        where: { tenantId },
        _max: { sortOrder: true },
      });
      await prisma.orderTypeDefinition.create({
        data: {
          tenantId,
          name: "Sonstiges",
          legacyKey: "SONSTIGES",
          isOther: true,
          sortOrder: (maxSort._max.sortOrder ?? 0) + 10,
          isActive: true,
        },
      });
    }
  }

  await backfillOrderTypeLinks(tenantId);
}

async function backfillOrderTypeLinks(tenantId: string) {
  const defs = await prisma.orderTypeDefinition.findMany({
    where: { tenantId },
    select: { id: true, name: true, legacyKey: true },
  });
  const byLegacy = new Map(
    defs.filter((d) => d.legacyKey).map((d) => [d.legacyKey as string, d])
  );

  const orders = await prisma.order.findMany({
    where: { tenantId, OR: [{ orderTypeId: null }, { orderTypeLabel: null }] },
    select: { id: true, orderType: true, orderTypeId: true, orderTypeLabel: true },
  });

  for (const order of orders) {
    const def = byLegacy.get(order.orderType);
    if (!def) continue;
    await prisma.order.update({
      where: { id: order.id },
      data: {
        ...(order.orderTypeId ? {} : { orderTypeId: def.id }),
        ...(order.orderTypeLabel ? {} : { orderTypeLabel: def.name }),
      },
    });
  }
}

export async function resolveOrderTypeAssignment(
  tenantId: string,
  input: {
    orderTypeId?: string | null;
    orderTypeCustom?: string | null;
    /** Fallback für alte Clients, die noch das Enum senden. */
    orderType?: string | null;
    /** Erlaubt inaktive Typen (z. B. bestehender Auftrag behält deaktivierten Typ). */
    allowInactive?: boolean;
  }
): Promise<{
  orderTypeId: string | null;
  orderTypeLabel: string;
  orderTypeCustom: string | null;
  orderType: OrderType;
  isOther: boolean;
} | { error: string }> {
  await ensureOrderTypeDefinitions(tenantId);

  let def =
    input.orderTypeId
      ? await prisma.orderTypeDefinition.findFirst({
          where: { id: input.orderTypeId, tenantId },
        })
      : null;

  if (!def && input.orderType) {
    def = await prisma.orderTypeDefinition.findFirst({
      where: { tenantId, legacyKey: input.orderType },
    });
  }

  if (!def) {
    def = await prisma.orderTypeDefinition.findFirst({
      where: { tenantId, isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }

  if (!def) {
    return { error: "Keine Auftragstypen vorhanden" };
  }

  if (!def.isActive && !input.allowInactive) {
    return { error: "Dieser Auftragstyp ist deaktiviert und kann nicht neu gewählt werden" };
  }

  const custom = def.isOther ? (input.orderTypeCustom?.trim() || null) : null;
  if (def.isOther && !custom) {
    return { error: "Bitte beschreiben Sie den Auftragstyp unter „Sonstiges“" };
  }

  const legacy =
    (def.legacyKey as OrderType | null) ??
    (def.isOther ? ("SONSTIGES" as OrderType) : ("REPARATUR" as OrderType));

  return {
    orderTypeId: def.id,
    orderTypeLabel: def.name,
    orderTypeCustom: custom,
    orderType: legacy,
    isOther: def.isOther,
  };
}
