import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";

/** Kunden aus eigenen Terminen (read-only für Monteur). */
export async function GET() {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiSuccess([]);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      employeeId: employee.id,
      status: { not: "STORNIERT" },
    },
    select: {
      order: {
        select: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              company: true,
            },
          },
          property: {
            select: { street: true, zipCode: true, city: true },
          },
        },
      },
    },
    orderBy: { startTime: "desc" },
    take: 200,
  });

  const seen = new Set<string>();
  const customers = [];
  for (const apt of appointments) {
    const c = apt.order.customer;
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    customers.push({
      ...c,
      primaryAddress: apt.order.property
        ? `${apt.order.property.street}, ${apt.order.property.zipCode} ${apt.order.property.city}`
        : null,
    });
  }

  return apiSuccess(customers);
}
