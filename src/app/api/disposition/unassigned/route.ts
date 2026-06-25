import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { DONE_ORDER_STATUSES, orderServiceLabel } from "@/lib/utils";

/** Aufträge ohne zugewiesenen Mitarbeiter (EINGEPLANT oder mit Termin, aber kein Appointment mit employeeId). */
export async function GET() {
  const auth = await requireAuth("appointments.read");
  if (auth instanceof Response) return auth;

  const orders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      status: { notIn: DONE_ORDER_STATUSES as never[] },
      OR: [
        { status: "EINGEPLANT", appointments: { none: { employeeId: { not: null }, status: { not: "STORNIERT" } } } },
        {
          scheduledStart: { not: null },
          appointments: { none: { employeeId: { not: null }, status: { not: "STORNIERT" } } },
        },
      ],
    },
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      phases: { orderBy: { sortOrder: "asc" } },
    },
    orderBy: { scheduledStart: "asc" },
    take: 50,
  });

  return apiSuccess(
    orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      title: o.title ?? o.services.map((s) => orderServiceLabel(s)).join(", "),
      customer: `${o.customer.firstName} ${o.customer.lastName}`,
      address: `${o.property.street}, ${o.property.city}`,
      scheduledStart: o.scheduledStart,
      scheduledEnd: o.scheduledEnd,
      status: o.status,
      phases: o.phases.filter((p) => p.isEnabled).map((p) => ({ id: p.id, name: p.name })),
    }))
  );
}
