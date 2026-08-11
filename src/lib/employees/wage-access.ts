import type { UserRole } from "@/generated/prisma/enums";
import { hasPermission } from "@/lib/permissions";

/** Interne Stundenlöhne nur für Büro/Kalkulation – nicht für Feldrollen. */
export function canViewEmployeeWages(role: UserRole): boolean {
  return hasPermission(role, "employees.write") || hasPermission(role, "calculations.read");
}

/** Entfernt Lohnfelder aus Employee-Objekten für unberechtigte Rollen. */
export function redactEmployeeWages<T extends Record<string, unknown>>(
  employee: T,
  role: UserRole
): T {
  if (canViewEmployeeWages(role)) return employee;
  return {
    ...employee,
    hourlyWageNet: null,
    billingHourlyRateNet: null,
  };
}

export function redactLaborCostFields<T extends Record<string, unknown>>(
  row: T,
  role: UserRole
): T {
  if (canViewEmployeeWages(role)) return row;
  return {
    ...row,
    hourlyWageNet: null,
    internalHourlyWageNet: null,
    laborCostNet: null,
  };
}
