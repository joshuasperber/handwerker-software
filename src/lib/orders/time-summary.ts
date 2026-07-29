import { calcLaborCost, calcWorkedHours } from "@/lib/time-entry";

export type OrderTimeEntryLike = {
  id: string;
  startTime: Date | string;
  endTime: Date | string | null;
  breakMinutes: number;
  activity: string | null;
  notes: string | null;
  status: string;
  employee: {
    id: string;
    hourlyWageNet?: number | null;
    user: { firstName: string; lastName: string };
  };
};

export type OrderTimeSummary = {
  plannedHours: number;
  actualHours: number;
  deltaHours: number;
  laborCostNet: number | null;
  missingWageCount: number;
  byEmployee: Array<{
    employeeId: string;
    name: string;
    hours: number;
    hourlyWageNet: number | null;
    laborCostNet: number | null;
  }>;
  entries: Array<{
    id: string;
    startTime: string;
    endTime: string | null;
    breakMinutes: number;
    activity: string | null;
    notes: string | null;
    status: string;
    hours: number | null;
    laborCostNet: number | null;
    employeeName: string;
    hourlyWageNet: number | null;
  }>;
};

/** Geplante Stunden aus Terminen und/oder Service-Dauern. */
export function calcPlannedHours(input: {
  appointments?: Array<{ startTime: Date | string; endTime: Date | string }>;
  services?: Array<{
    quantity?: number | null;
    service?: { durationMinutes?: number | null } | null;
  }>;
  scheduledStart?: Date | string | null;
  scheduledEnd?: Date | string | null;
}): number {
  let fromAppointments = 0;
  for (const apt of input.appointments ?? []) {
    const h = calcWorkedHours(apt.startTime, apt.endTime, 0);
    if (h != null) fromAppointments += h;
  }

  let fromServices = 0;
  for (const os of input.services ?? []) {
    const mins = os.service?.durationMinutes ?? 0;
    const qty = os.quantity ?? 1;
    if (mins > 0) fromServices += (mins / 60) * qty;
  }

  let fromSchedule = 0;
  if (input.scheduledStart && input.scheduledEnd) {
    const h = calcWorkedHours(input.scheduledStart, input.scheduledEnd, 0);
    if (h != null) fromSchedule = h;
  }

  // Priorität: Terminzeiten > Auftragsfenster > Leistungsdauer
  if (fromAppointments > 0) return Math.round(fromAppointments * 100) / 100;
  if (fromSchedule > 0) return Math.round(fromSchedule * 100) / 100;
  return Math.round(fromServices * 100) / 100;
}

export function summarizeOrderTimeEntries(
  entries: OrderTimeEntryLike[],
  plannedHours = 0
): OrderTimeSummary {
  const byEmployeeMap = new Map<
    string,
    {
      employeeId: string;
      name: string;
      hours: number;
      hourlyWageNet: number | null;
      laborCostNet: number;
      hasWage: boolean;
    }
  >();

  let actualHours = 0;
  let laborCostNet = 0;
  let hasAnyWage = false;
  let missingWageCount = 0;

  const mapped = entries.map((e) => {
    const hours = calcWorkedHours(e.startTime, e.endTime, e.breakMinutes ?? 0);
    const wage = e.employee.hourlyWageNet ?? null;
    const cost = calcLaborCost(hours, wage);
    const name = `${e.employee.user.firstName} ${e.employee.user.lastName}`.trim();

    if (hours != null) {
      actualHours += hours;
      const cur = byEmployeeMap.get(e.employee.id) ?? {
        employeeId: e.employee.id,
        name,
        hours: 0,
        hourlyWageNet: wage,
        laborCostNet: 0,
        hasWage: wage != null,
      };
      cur.hours += hours;
      if (wage != null) {
        cur.hasWage = true;
        cur.hourlyWageNet = wage;
        if (cost != null) cur.laborCostNet += cost;
      }
      byEmployeeMap.set(e.employee.id, cur);
    }

    if (cost != null) {
      laborCostNet += cost;
      hasAnyWage = true;
    } else if (hours != null && hours > 0 && wage == null) {
      missingWageCount += 1;
    }

    return {
      id: e.id,
      startTime: new Date(e.startTime).toISOString(),
      endTime: e.endTime ? new Date(e.endTime).toISOString() : null,
      breakMinutes: e.breakMinutes ?? 0,
      activity: e.activity,
      notes: e.notes,
      status: e.status,
      hours,
      laborCostNet: cost,
      employeeName: name,
      hourlyWageNet: wage,
    };
  });

  return {
    plannedHours: Math.round(plannedHours * 100) / 100,
    actualHours: Math.round(actualHours * 100) / 100,
    deltaHours: Math.round((actualHours - plannedHours) * 100) / 100,
    laborCostNet: hasAnyWage ? Math.round(laborCostNet * 100) / 100 : null,
    missingWageCount,
    byEmployee: Array.from(byEmployeeMap.values()).map((row) => ({
      employeeId: row.employeeId,
      name: row.name,
      hours: Math.round(row.hours * 100) / 100,
      hourlyWageNet: row.hourlyWageNet,
      laborCostNet: row.hasWage ? Math.round(row.laborCostNet * 100) / 100 : null,
    })),
    entries: mapped,
  };
}
