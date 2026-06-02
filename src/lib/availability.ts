import {
  addDays,
  addMinutes,
  format,
  isAfter,
  isBefore,
  parse,
  setHours,
  setMinutes,
  startOfDay,
} from "date-fns";
import { prisma } from "./prisma";

export interface TimeSlot {
  start: Date;
  end: Date;
  employeeId?: string;
  employeeName?: string;
}

interface AvailabilityParams {
  tenantId: string;
  serviceIds: string[];
  zipCode: string;
  fromDate?: Date;
  daysAhead?: number;
}

function parseTimeOnDate(date: Date, timeStr: string): Date {
  const parsed = parse(timeStr, "HH:mm", date);
  return parsed;
}

function isZipInArea(zip: string, zipFrom: string, zipTo: string): boolean {
  const zipNum = parseInt(zip, 10);
  const fromNum = parseInt(zipFrom, 10);
  const toNum = parseInt(zipTo, 10);
  if (isNaN(zipNum) || isNaN(fromNum) || isNaN(toNum)) {
    return zip >= zipFrom && zip <= zipTo;
  }
  return zipNum >= fromNum && zipNum <= toNum;
}

export async function calculateAvailability(
  params: AvailabilityParams
): Promise<TimeSlot[]> {
  const { tenantId, serviceIds, zipCode, fromDate = new Date(), daysAhead = 14 } =
    params;

  const [tenant, services, serviceAreas, workingHours, employees] =
    await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId } }),
      prisma.service.findMany({
        where: { id: { in: serviceIds }, tenantId, isActive: true },
        include: { qualifications: true },
      }),
      prisma.serviceArea.findMany({ where: { tenantId } }),
      prisma.workingHours.findMany({
        where: { tenantId, isActive: true },
      }),
      prisma.employee.findMany({
        where: { tenantId, user: { isActive: true, role: "MONTEUR" } },
        include: {
          user: true,
          qualifications: true,
          workingHours: { where: { isActive: true } },
          appointments: {
            where: {
              startTime: { gte: startOfDay(fromDate) },
              status: { not: "STORNIERT" },
            },
          },
        },
      }),
    ]);

  if (!tenant || services.length === 0) return [];

  const inServiceArea =
    serviceAreas.length === 0 ||
    serviceAreas.some((area) => isZipInArea(zipCode, area.zipFrom, area.zipTo));

  if (!inServiceArea) return [];

  const totalDuration = services.reduce(
    (sum, s) => sum + s.durationMinutes + s.bufferMinutes,
    tenant.bufferMinutes
  );

  const requiredQualifications = new Set(
    services.flatMap((s) => s.qualifications.map((q) => q.name))
  );

  const qualifiedEmployees = employees.filter((emp) => {
    if (requiredQualifications.size === 0) return true;
    const empQuals = new Set(emp.qualifications.map((q) => q.name));
    return [...requiredQualifications].every((q) => empQuals.has(q));
  });

  if (qualifiedEmployees.length === 0) return [];

  const slots: TimeSlot[] = [];
  const slotInterval = 30;

  for (let dayOffset = 0; dayOffset < daysAhead; dayOffset++) {
    const currentDate = addDays(startOfDay(fromDate), dayOffset);
    const dayOfWeek = currentDate.getDay();

    const tenantHours = workingHours.filter((wh) => wh.dayOfWeek === dayOfWeek);
    if (tenantHours.length === 0) continue;

    for (const wh of tenantHours) {
      let slotStart = parseTimeOnDate(currentDate, wh.startTime);
      const dayEnd = parseTimeOnDate(currentDate, wh.endTime);

      while (isBefore(addMinutes(slotStart, totalDuration), dayEnd) ||
        format(addMinutes(slotStart, totalDuration), "HH:mm") <= format(dayEnd, "HH:mm")) {
        const slotEnd = addMinutes(slotStart, totalDuration);

        if (isAfter(slotStart, fromDate)) {
          for (const employee of qualifiedEmployees) {
            const empHours = employee.workingHours.filter(
              (eh) => eh.dayOfWeek === dayOfWeek
            );

            const empAvailable =
              empHours.length === 0 ||
              empHours.some((eh) => {
                const empStart = parseTimeOnDate(currentDate, eh.startTime);
                const empEnd = parseTimeOnDate(currentDate, eh.endTime);
                return (
                  !isBefore(slotStart, empStart) && !isAfter(slotEnd, empEnd)
                );
              });

            if (!empAvailable) continue;

            const hasConflict = employee.appointments.some((apt) => {
              const aptStart = new Date(apt.startTime);
              const aptEnd = new Date(apt.endTime);
              return slotStart < aptEnd && slotEnd > aptStart;
            });

            if (!hasConflict) {
              slots.push({
                start: new Date(slotStart),
                end: slotEnd,
                employeeId: employee.id,
                employeeName: `${employee.user.firstName} ${employee.user.lastName}`,
              });
              break;
            }
          }
        }

        slotStart = addMinutes(slotStart, slotInterval);
        if (!isBefore(slotStart, dayEnd)) break;
      }
    }
  }

  return slots.slice(0, 50);
}

export function formatSlotTime(slot: TimeSlot): string {
  return `${format(slot.start, "dd.MM.yyyy HH:mm")} – ${format(slot.end, "HH:mm")}`;
}
