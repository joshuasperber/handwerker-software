import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { getEmployeeForUser } from "@/lib/monteur-access";

export function canReadCustomers(auth: SessionUser): boolean {
  return hasPermission(auth.role, "customers.read");
}

export function canReadEmployees(auth: SessionUser): boolean {
  return hasPermission(auth.role, "employees.read");
}

export function canReadOrders(auth: SessionUser): boolean {
  return hasPermission(auth.role, "orders.read") || hasPermission(auth.role, "monteur.own");
}

export function canReadInvoices(auth: SessionUser): boolean {
  return hasPermission(auth.role, "invoices.read");
}

export function canReadInventory(auth: SessionUser): boolean {
  return hasPermission(auth.role, "inventory.read");
}

export function canReadFinance(auth: SessionUser): boolean {
  return hasPermission(auth.role, "invoices.read");
}

/** Prüft, ob der Nutzer Daten zu einer Person sehen darf (Monteur: nur sich selbst). */
export async function canViewPersonData(
  auth: SessionUser,
  targetUserId?: string
): Promise<boolean> {
  if (hasPermission(auth.role, "employees.read") || hasPermission(auth.role, "customers.read")) {
    return true;
  }
  if (auth.role === "MONTEUR") {
    return !targetUserId || targetUserId === auth.id;
  }
  return false;
}

/** Auftragsfilter je nach Rolle — Monteur nur zugewiesene/freigegebene Aufträge. */
export async function buildOrderAccessFilter(
  auth: SessionUser
): Promise<Prisma.OrderWhereInput> {
  const base: Prisma.OrderWhereInput = { tenantId: auth.tenantId };

  if (hasPermission(auth.role, "orders.read")) {
    return base;
  }

  if (hasPermission(auth.role, "monteur.own")) {
    const employee = await getEmployeeForUser(auth);
    if (!employee) {
      return { ...base, id: "__no_access__" };
    }
    return {
      ...base,
      OR: [
        { appointments: { some: { employeeId: employee.id } } },
        { phases: { some: { assignedEmployeeId: employee.id } } },
        { shares: { some: { sharedWithUserId: auth.id } } },
      ],
    };
  }

  return { ...base, id: "__no_access__" };
}

/** Terminfilter je nach Rolle. */
export async function buildAppointmentAccessFilter(
  auth: SessionUser
): Promise<Prisma.AppointmentWhereInput> {
  const base: Prisma.AppointmentWhereInput = { tenantId: auth.tenantId };

  if (hasPermission(auth.role, "appointments.read")) {
    return base;
  }

  if (hasPermission(auth.role, "monteur.own")) {
    const employee = await getEmployeeForUser(auth);
    if (!employee) return { ...base, id: "__no_access__" };
    return { ...base, employeeId: employee.id };
  }

  return { ...base, id: "__no_access__" };
}

/** Prüft, ob Monteur nur eigene Daten abfragen darf. */
export async function enforceMonteurSelfQuery(
  auth: SessionUser,
  requestedName: string | undefined,
  matchedEmployeeUserId?: string
): Promise<{ allowed: boolean; reason?: string }> {
  if (auth.role !== "MONTEUR" || hasPermission(auth.role, "employees.read")) {
    return { allowed: true };
  }

  if (!requestedName) {
    return { allowed: true };
  }

  const selfName = `${auth.firstName} ${auth.lastName}`.toLowerCase();
  const firstOnly = auth.firstName.toLowerCase();
  const req = requestedName.toLowerCase();

  if (
    selfName.includes(req) ||
    req.includes(firstOnly) ||
    matchedEmployeeUserId === auth.id
  ) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Als Monteur kannst du nur deine eigenen Termine und Mitnahmelisten abfragen (z. B. „${auth.firstName}“).`,
  };
}
