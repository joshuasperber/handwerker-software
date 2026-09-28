import { prisma } from "@/lib/prisma";

export async function requireTenantOrder(tenantId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, tenantId },
    select: { id: true },
  });
}

export async function requireTenantEmployee(tenantId: string, employeeId: string) {
  return prisma.employee.findFirst({
    where: { id: employeeId, tenantId },
    select: { id: true },
  });
}

/** Prüft, ob Kunde, Objekt, Leistungen und optional Mitarbeiter zum Mandanten gehören. */
export async function validateOrderCreateRefs(
  tenantId: string,
  refs: {
    customerId: string;
    propertyId: string;
    serviceIds?: string[];
    employeeId?: string | null;
    employeeIds?: string[];
  }
): Promise<string | null> {
  const employeeIds = [
    ...new Set(
      [...(refs.employeeIds ?? []), ...(refs.employeeId ? [refs.employeeId] : [])].filter(Boolean)
    ),
  ];

  const [customer, property, serviceCount, employeeCount] = await Promise.all([
    prisma.customer.findFirst({
      where: { id: refs.customerId, tenantId },
      select: { id: true },
    }),
    prisma.property.findFirst({
      where: { id: refs.propertyId, tenantId, customerId: refs.customerId },
      select: { id: true },
    }),
    refs.serviceIds?.length
      ? prisma.service.count({
          where: { id: { in: refs.serviceIds }, tenantId },
        })
      : Promise.resolve(0),
    employeeIds.length
      ? prisma.employee.count({
          where: { id: { in: employeeIds }, tenantId },
        })
      : Promise.resolve(0),
  ]);

  if (!customer) return "Kunde nicht gefunden";
  if (!property) return "Objekt nicht gefunden";
  if (refs.serviceIds?.length && serviceCount !== refs.serviceIds.length) {
    return "Leistung nicht gefunden";
  }
  if (employeeIds.length && employeeCount !== employeeIds.length) {
    return "Mitarbeiter nicht gefunden";
  }

  return null;
}
