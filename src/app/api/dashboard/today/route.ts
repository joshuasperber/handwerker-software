import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { materialAmpel } from "@/lib/inventory/formulas";
import { getCurrentPhase } from "@/lib/phase-status";

export async function GET() {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const orders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      OR: [
        { scheduledStart: { gte: todayStart, lte: todayEnd } },
        { appointments: { some: { startTime: { gte: todayStart, lte: todayEnd } } } },
      ],
      status: { notIn: ["STORNIERT", "ABGERECHNET"] },
    },
    include: {
      customer: true,
      property: true,
      team: { select: { id: true, name: true } },
      vehicle: { select: { id: true, name: true, licensePlate: true } },
      phases: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignedTeam: { select: { id: true, name: true } },
          assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
        },
      },
      appointments: {
        where: { startTime: { gte: todayStart, lte: todayEnd } },
        include: { employee: { include: { user: true } } },
      },
      services: { include: { service: true } },
    },
    orderBy: { scheduledStart: "asc" },
  });

  const items = orders.map((o) => {
    const currentPhase = getCurrentPhase(o.phases);
    const phaseEmployee = currentPhase?.assignedEmployee
      ? `${currentPhase.assignedEmployee.user.firstName} ${currentPhase.assignedEmployee.user.lastName}`
      : null;
    return {
    id: o.id,
    orderNumber: o.orderNumber,
    title: o.title ?? o.services.map((s) => s.service?.name ?? s.customName ?? "Sonstige Leistung").join(", "),
    customer: `${o.customer.firstName} ${o.customer.lastName}`,
    address: `${o.property.street}, ${o.property.zipCode} ${o.property.city}`,
    status: o.status,
    materialStatus: o.materialStatus,
    materialAmpel: materialAmpel(o.materialStatus),
    phase: currentPhase?.name ?? "—",
    phaseStatus: currentPhase?.status ?? null,
    phaseTeam: currentPhase?.assignedTeam?.name ?? null,
    phaseEmployee,
    team: o.team?.name ?? null,
    vehicle: o.vehicle ? { name: o.vehicle.name, licensePlate: o.vehicle.licensePlate } : null,
    scheduledStart: o.scheduledStart,
    employees: o.appointments.map(
      (a) => a.employee && `${a.employee.user.firstName} ${a.employee.user.lastName}`
    ).filter(Boolean),
    };
  });

  return apiSuccess({ date: todayStart.toISOString(), orders: items, count: items.length });
}
