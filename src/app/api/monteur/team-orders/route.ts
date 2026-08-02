import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

/**
 * Aufträge der Unternehmens-Mitarbeiter für die Team-Ansicht (Arbeitsansicht).
 * Reduzierte Felder — keine Finanzdaten.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const employeeId = request.nextUrl.searchParams.get("employeeId");
  const take = Math.min(Number(request.nextUrl.searchParams.get("limit") || 80), 150);

  try {
    const orders = await prisma.order.findMany({
      where: {
        tenantId: auth.tenantId,
        status: { not: "STORNIERT" },
        ...(employeeId
          ? {
              OR: [
                { assignees: { some: { employeeId } } },
                { appointments: { some: { employeeId, status: { not: "STORNIERT" } } } },
                { team: { members: { some: { employeeId } } } },
              ],
            }
          : {
              OR: [
                { assignees: { some: {} } },
                { appointments: { some: { status: { not: "STORNIERT" } } } },
                { scheduledStart: { not: null } },
              ],
            }),
      },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        scheduledStart: true,
        scheduledEnd: true,
        updatedAt: true,
        customer: { select: { firstName: true, lastName: true, company: true } },
        property: { select: { street: true, zipCode: true, city: true } },
        assignees: {
          select: {
            employee: {
              select: {
                id: true,
                color: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
        },
        appointments: {
          where: { status: { not: "STORNIERT" } },
          select: {
            startTime: true,
            employee: {
              select: {
                id: true,
                user: { select: { firstName: true, lastName: true } },
              },
            },
          },
          orderBy: { startTime: "asc" },
          take: 3,
        },
      },
      orderBy: [{ scheduledStart: "asc" }, { updatedAt: "desc" }],
      take,
    });

    return apiSuccess(
      orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        title: o.title,
        status: o.status,
        scheduledStart: o.scheduledStart,
        scheduledEnd: o.scheduledEnd,
        customerName:
          o.customer.company || `${o.customer.firstName} ${o.customer.lastName}`,
        address: o.property
          ? `${o.property.street}, ${o.property.zipCode} ${o.property.city}`
          : null,
        assignees: o.assignees.map((a) => ({
          id: a.employee.id,
          name: `${a.employee.user.firstName} ${a.employee.user.lastName}`,
          color: a.employee.color,
        })),
        nextAppointment: o.appointments[0]
          ? {
              startTime: o.appointments[0].startTime,
              employeeName: o.appointments[0].employee
                ? `${o.appointments[0].employee.user.firstName} ${o.appointments[0].employee.user.lastName}`
                : null,
            }
          : null,
      }))
    );
  } catch (err) {
    console.error("[monteur/team-orders]", err);
    return apiError("Aufträge konnten nicht geladen werden", 500);
  }
}
