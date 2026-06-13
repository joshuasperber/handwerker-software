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
  }
): Promise<string | null> {
  const customer = await prisma.customer.findFirst({
    where: { id: refs.customerId, tenantId },
    select: { id: true },
  });
  if (!customer) return "Kunde nicht gefunden";

  const property = await prisma.property.findFirst({
    where: { id: refs.propertyId, tenantId, customerId: refs.customerId },
    select: { id: true },
  });
  if (!property) return "Objekt nicht gefunden";

  if (refs.serviceIds?.length) {
    const count = await prisma.service.count({
      where: { id: { in: refs.serviceIds }, tenantId },
    });
    if (count !== refs.serviceIds.length) return "Leistung nicht gefunden";
  }

  if (refs.employeeId) {
    const employee = await requireTenantEmployee(tenantId, refs.employeeId);
    if (!employee) return "Mitarbeiter nicht gefunden";
  }

  return null;
}
