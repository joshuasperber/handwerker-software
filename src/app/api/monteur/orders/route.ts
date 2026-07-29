import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getEmployeeForUser, getTeamIdsForEmployee } from "@/lib/monteur-access";
import { hasPermission } from "@/lib/permissions";

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  title: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { firstName: true, lastName: true } },
} as const;

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  title: string | null;
  createdAt: Date;
  updatedAt: Date;
  customer: { firstName: string; lastName: string };
};

function sortNewestFirst(orders: OrderRow[]) {
  orders.sort((a, b) => {
    const tb = b.updatedAt?.getTime?.() ?? 0;
    const ta = a.updatedAt?.getTime?.() ?? 0;
    if (tb !== ta) return tb - ta;
    return (b.createdAt?.getTime?.() ?? 0) - (a.createdAt?.getTime?.() ?? 0);
  });
}

/**
 * Aufträge für Stundenzettel.
 * Query: `scope=mine` (Standard) | `scope=all`
 *
 * - mine: Assignees, Termine, Phasen, Team-Zuordnung, eigene Zeitbuchungen
 * - all: alle nicht stornierten Aufträge des Tenants (für Zeitbuchung)
 * Neueste zuerst (updatedAt).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth("monteur.own");
    if (auth instanceof Response) return auth;

    const tenantId = auth.tenantId;
    const effectiveScope =
      request.nextUrl.searchParams.get("scope") === "all" ? "all" : "mine";
    const canReadAllOrders = hasPermission(auth.role, "orders.read");
    const employee = await getEmployeeForUser(auth);

    const seen = new Set<string>();
    const orders: OrderRow[] = [];

    function pushOrder(order: OrderRow | null | undefined) {
      if (!order || seen.has(order.id)) return;
      if (order.status === "STORNIERT") return;
      seen.add(order.id);
      orders.push(order);
    }

    async function loadAllOpenOrders() {
      const allOrders = await prisma.order.findMany({
        where: {
          tenantId,
          status: { not: "STORNIERT" },
        },
        select: orderSelect,
        orderBy: { updatedAt: "desc" },
        take: 200,
      });
      for (const order of allOrders) pushOrder(order);
    }

    if (!employee) {
      if (canReadAllOrders) {
        await loadAllOpenOrders();
        sortNewestFirst(orders);
        return apiSuccess({
          scope: "all",
          orders,
          canViewAll: true,
          missingEmployeeProfile: true,
        });
      }
      return apiSuccess({
        scope: "mine",
        orders: [],
        canViewAll: false,
        missingEmployeeProfile: true,
      });
    }

    if (effectiveScope === "all") {
      await loadAllOpenOrders();
    } else {
      const teamIds = await getTeamIdsForEmployee(employee.id);

      const [assignedOrders, appointments, phaseOrders, teamOrders, timeEntryOrders] =
        await Promise.all([
          prisma.order.findMany({
            where: {
              tenantId,
              status: { not: "STORNIERT" },
              assignees: { some: { employeeId: employee.id } },
            },
            select: orderSelect,
            orderBy: { updatedAt: "desc" },
            take: 120,
          }),
          prisma.appointment.findMany({
            where: {
              tenantId,
              status: { not: "STORNIERT" },
              OR: [
                { employeeId: employee.id },
                ...(teamIds.length
                  ? [{ order: { teamId: { in: teamIds } } }]
                  : []),
              ],
            },
            select: { order: { select: orderSelect } },
            orderBy: { startTime: "desc" },
            take: 120,
          }),
          prisma.order.findMany({
            where: {
              tenantId,
              status: { not: "STORNIERT" },
              phases: {
                some: {
                  OR: [
                    { assignedEmployeeId: employee.id },
                    ...(teamIds.length
                      ? [{ assignedTeamId: { in: teamIds } }]
                      : []),
                  ],
                },
              },
            },
            select: orderSelect,
            orderBy: { updatedAt: "desc" },
            take: 120,
          }),
          teamIds.length
            ? prisma.order.findMany({
                where: {
                  tenantId,
                  status: { not: "STORNIERT" },
                  teamId: { in: teamIds },
                },
                select: orderSelect,
                orderBy: { updatedAt: "desc" },
                take: 120,
              })
            : Promise.resolve([] as OrderRow[]),
          prisma.order.findMany({
            where: {
              tenantId,
              status: { not: "STORNIERT" },
              timeEntries: { some: { employeeId: employee.id } },
            },
            select: orderSelect,
            orderBy: { updatedAt: "desc" },
            take: 80,
          }),
        ]);

      for (const order of assignedOrders) pushOrder(order);
      for (const apt of appointments) pushOrder(apt.order);
      for (const order of phaseOrders) pushOrder(order);
      for (const order of teamOrders) pushOrder(order);
      for (const order of timeEntryOrders) pushOrder(order);
    }

    sortNewestFirst(orders);

    return apiSuccess({
      scope: effectiveScope,
      orders,
      canViewAll: true,
      missingEmployeeProfile: false,
    });
  } catch (err) {
    console.error("[monteur/orders]", err);
    return apiError(
      err instanceof Error ? err.message : "Aufträge konnten nicht geladen werden",
      500
    );
  }
}
