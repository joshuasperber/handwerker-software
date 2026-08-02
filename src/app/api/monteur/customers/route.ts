import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";

/** Kunden für Monteur-Self-Service (nur aus eigenen Aufträgen/Terminen). */
export async function GET() {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiSuccess([]);

  const linkedOrders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      OR: [
        { assignees: { some: { employeeId: employee.id } } },
        { appointments: { some: { employeeId: employee.id } } },
      ],
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });

  const customerIds = linkedOrders.map((o) => o.customerId);
  if (!customerIds.length) return apiSuccess([]);

  const customers = await prisma.customer.findMany({
    where: { tenantId: auth.tenantId, id: { in: customerIds } },
    include: {
      properties: { select: { id: true, label: true, street: true, city: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 100,
  });

  return apiSuccess(
    customers.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      properties: c.properties,
    }))
  );
}
