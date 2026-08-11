import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { calcPlannedHours, summarizeOrderTimeEntries } from "@/lib/orders/time-summary";
import { laborItemsFromTimeSummary } from "@/lib/calculation/labor-costs";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";

/**
 * Übernimmt gebuchte Stundenzettel des verknüpften Auftrags als Arbeitspositionen.
 * Ersetzt bestehende LaborItems (bewusst – Button in der UI).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const calc = await prisma.calculation.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, orderId: true },
  });
  if (!calc) return apiError("Kalkulation nicht gefunden", 404);
  if (!calc.orderId) {
    return apiError("Diese Kalkulation ist keinem Auftrag zugeordnet.", 400);
  }

  const order = await prisma.order.findFirst({
    where: { id: calc.orderId, tenantId: auth.tenantId },
    include: {
      appointments: { select: { startTime: true, endTime: true } },
      services: { include: { service: { select: { durationMinutes: true } } } },
      timeEntries: {
        include: {
          employee: {
            include: { user: { select: { firstName: true, lastName: true } } },
          },
        },
        orderBy: { startTime: "asc" },
      },
    },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const planned = calcPlannedHours({
    appointments: order.appointments,
    services: order.services,
    scheduledStart: order.scheduledStart,
    scheduledEnd: order.scheduledEnd,
  });
  const summary = summarizeOrderTimeEntries(order.timeEntries, planned);
  if (!summary.byEmployee.length) {
    return apiError("Keine gebuchten Stunden auf diesem Auftrag.", 400);
  }

  const company = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
    select: { defaultHourlyRate: true },
  });
  const defaultRate = company?.defaultHourlyRate ?? 68;

  const employees = await prisma.employee.findMany({
    where: {
      tenantId: auth.tenantId,
      id: { in: summary.byEmployee.map((e) => e.employeeId) },
    },
    select: { id: true, billingHourlyRateNet: true, defaultActivity: true },
  });
  const billingRates: Record<string, number | null | undefined> = {};
  let defaultActivity: string | undefined;
  for (const e of employees) {
    billingRates[e.id] = e.billingHourlyRateNet;
    if (!defaultActivity && e.defaultActivity) defaultActivity = e.defaultActivity;
  }

  const items = laborItemsFromTimeSummary(summary.byEmployee, {
    billingHourlyRateNet: defaultRate,
    billingRatesByEmployee: billingRates,
    defaultActivity: defaultActivity || "Montagearbeiten",
  });

  await prisma.laborItem.deleteMany({ where: { calculationId: id } });
  await prisma.laborItem.createMany({
    data: items.map((l) => ({
      calculationId: id,
      employeeId: l.employeeId,
      description: l.description,
      laborType: l.laborType,
      hours: l.hours,
      actualHours: l.actualHours,
      hourlyRateNet: l.hourlyRateNet,
      internalHourlyWageNet: l.internalHourlyWageNet,
      quantityWorkers: 1,
      notes: l.notes,
      isVisibleToCustomer: l.isVisibleToCustomer,
    })),
  });

  const result = await recalculateCalculationRecord(id, auth.tenantId);
  return apiSuccess({
    imported: items.length,
    summary: {
      plannedHours: summary.plannedHours,
      actualHours: summary.actualHours,
      deltaHours: summary.deltaHours,
      laborCostNet: summary.laborCostNet,
    },
    calculation: result,
  });
}
