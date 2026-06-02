/** Material-Abholliste für Monteur – inkl. Reserve für den Tageseinsatz */

export const PICKUP_RESERVE_PERCENT = 15;

export function calcPickupWithReserve(quantityRequired: number, isTool: boolean): number {
  if (quantityRequired <= 0) return 0;
  if (isTool) return quantityRequired;
  if (quantityRequired === 1) return 2;
  return Math.ceil(quantityRequired * (1 + PICKUP_RESERVE_PERCENT / 100));
}

export type PickupLineSource = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  name: string;
  unit: string;
  isTool: boolean;
  quantityRequired: number;
  pickupQty: number;
  reserved: boolean;
  storageLocation?: string;
};

export type PickupAggregateLine = {
  key: string;
  name: string;
  unit: string;
  isTool: boolean;
  totalRequired: number;
  totalPickup: number;
  reserved: boolean;
  storageLocation?: string;
  sources: PickupLineSource[];
};

export type MaterialLineInput = {
  id: string;
  name: string;
  quantityRequired: number;
  unit: string;
  isTool: boolean;
  articleId?: string | null;
  reservations?: { status: string; quantity: number; storageLocation?: { name: string } }[];
};

export type OrderPickupInput = {
  id: string;
  orderNumber: string;
  customer: { firstName: string; lastName: string };
  materialLines: MaterialLineInput[];
};

export function buildPickupList(orders: OrderPickupInput[]): {
  byOrder: { orderId: string; orderNumber: string; customerName: string; lines: PickupLineSource[] }[];
  aggregated: PickupAggregateLine[];
} {
  const byOrder = orders.map((order) => {
    const customerName = `${order.customer.firstName} ${order.customer.lastName}`;
    const lines: PickupLineSource[] = order.materialLines.map((line) => {
      const activeRes = line.reservations?.filter((r) =>
        ["VORGESCHLAGEN", "RESERVIERT"].includes(r.status)
      );
      const reserved = (activeRes?.length ?? 0) > 0;
      const storageLocation = activeRes?.[0]?.storageLocation?.name;
      const pickupQty = calcPickupWithReserve(line.quantityRequired, line.isTool);
      return {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName,
        name: line.name,
        unit: line.unit,
        isTool: line.isTool,
        quantityRequired: line.quantityRequired,
        pickupQty,
        reserved,
        storageLocation,
      };
    });
    return { orderId: order.id, orderNumber: order.orderNumber, customerName, lines };
  });

  const aggMap = new Map<string, PickupAggregateLine>();

  for (const order of orders) {
    const customerName = `${order.customer.firstName} ${order.customer.lastName}`;
    for (const line of order.materialLines) {
      const key = line.articleId ?? line.name;
      const activeRes = line.reservations?.filter((r) =>
        ["VORGESCHLAGEN", "RESERVIERT"].includes(r.status)
      );
      const reserved = (activeRes?.length ?? 0) > 0;
      const storageLocation = activeRes?.[0]?.storageLocation?.name;
      const pickupQty = calcPickupWithReserve(line.quantityRequired, line.isTool);

      const existing = aggMap.get(key);
      const source: PickupLineSource = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName,
        name: line.name,
        unit: line.unit,
        isTool: line.isTool,
        quantityRequired: line.quantityRequired,
        pickupQty,
        reserved,
        storageLocation,
      };

      if (existing) {
        existing.totalRequired += line.quantityRequired;
        existing.totalPickup += pickupQty;
        existing.reserved = existing.reserved || reserved;
        existing.sources.push(source);
        if (!existing.storageLocation && storageLocation) {
          existing.storageLocation = storageLocation;
        }
      } else {
        aggMap.set(key, {
          key,
          name: line.name,
          unit: line.unit,
          isTool: line.isTool,
          totalRequired: line.quantityRequired,
          totalPickup: pickupQty,
          reserved,
          storageLocation,
          sources: [source],
        });
      }
    }
  }

  return {
    byOrder,
    aggregated: [...aggMap.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
