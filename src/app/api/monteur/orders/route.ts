import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeForUser } from "@/lib/monteur-access";

/** Eigene Aufträge (z. B. für Nachrichten / Materialanfragen). */
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
          id: true,
          orderNumber: true,
          status: true,
          customer: { select: { firstName: true, lastName: true } },
        },
      },
    },
    orderBy: { startTime: "desc" },
    take: 50,
  });

  const seen = new Set<string>();
  const orders = [];
  for (const apt of appointments) {
    if (seen.has(apt.order.id)) continue;
    seen.add(apt.order.id);
    orders.push(apt.order);
  }

  const phaseOrders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      phases: { some: { assignedEmployeeId: employee.id } },
    },
    select: {
      id: true,
      orderNumber: true,
      status: true,
      customer: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  for (const order of phaseOrders) {
    if (seen.has(order.id)) continue;
    seen.add(order.id);
    orders.push(order);
  }

  return apiSuccess(orders);
}
