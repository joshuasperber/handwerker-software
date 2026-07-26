import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmployeeForUser, getTeamIdsForEmployee } from "@/lib/monteur-access";
import { hasPermission } from "@/lib/permissions";

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  title: true,
  customer: { select: { firstName: true, lastName: true } },
} as const;

/**
 * Aufträge für Stundenzettel / Monteur-Auswahl.
 * Enthält persönliche Termine, Phasen, Team-Zuordnungen —
 * und für Büro/Meister zusätzlich aktuelle Aufträge des Tenants.
 */
export async function GET() {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const employee = await getEmployeeForUser(auth);
  if (!employee) return apiSuccess([]);

  const teamIds = await getTeamIdsForEmployee(employee.id);
  const seen = new Set<string>();
  const orders: Array<{
    id: string;
    orderNumber: string;
    status: string;
    title: string | null;
    customer: { firstName: string; lastName: string };
  }> = [];

  function pushOrder(order: (typeof orders)[number] | null | undefined) {
    if (!order || seen.has(order.id)) return;
    if (order.status === "STORNIERT") return;
    seen.add(order.id);
    orders.push(order);
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      status: { not: "STORNIERT" },
      OR: [
        { employeeId: employee.id },
        ...(teamIds.length ? [{ order: { teamId: { in: teamIds } } }] : []),
      ],
    },
    select: { order: { select: orderSelect } },
    orderBy: { startTime: "desc" },
    take: 80,
  });
  for (const apt of appointments) pushOrder(apt.order);

  const phaseOrders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      status: { not: "STORNIERT" },
      phases: {
        some: {
          OR: [
            { assignedEmployeeId: employee.id },
            ...(teamIds.length ? [{ assignedTeamId: { in: teamIds } }] : []),
          ],
        },
      },
    },
    select: orderSelect,
    orderBy: { updatedAt: "desc" },
    take: 80,
  });
  for (const order of phaseOrders) pushOrder(order);

  if (teamIds.length) {
    const teamOrders = await prisma.order.findMany({
      where: {
        tenantId: auth.tenantId,
        status: { not: "STORNIERT" },
        teamId: { in: teamIds },
      },
      select: orderSelect,
      orderBy: { updatedAt: "desc" },
      take: 80,
    });
    for (const order of teamOrders) pushOrder(order);
  }

  // Büro / Meister: zusätzlich offene und laufende Aufträge zur Auswahl
  if (hasPermission(auth.role, "orders.read")) {
    const officeOrders = await prisma.order.findMany({
      where: {
        tenantId: auth.tenantId,
        status: {
          notIn: ["STORNIERT", "ABGERECHNET"],
        },
      },
      select: orderSelect,
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    for (const order of officeOrders) pushOrder(order);
  }

  orders.sort((a, b) => a.orderNumber.localeCompare(b.orderNumber, "de"));

  return apiSuccess(orders);
}
