import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";

/** Kunden für Monteur-Self-Service (eigene vergangene Aufträge + Tenant-Kunden). */
export async function GET() {
  const auth = await requireAuth("monteur.create_own");
  if (auth instanceof Response) return auth;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiSuccess([]);

  const customers = await prisma.customer.findMany({
    where: { tenantId: auth.tenantId },
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
