import { UserRole } from "@/generated/prisma/client";

export type Permission =
  | "tenant.manage"
  | "users.manage"
  | "customers.read"
  | "customers.write"
  | "orders.read"
  | "orders.write"
  | "orders.assign"
  | "appointments.read"
  | "appointments.write"
  | "employees.read"
  | "employees.write"
  | "services.read"
  | "services.write"
  | "checklists.read"
  | "checklists.write"
  | "messages.read"
  | "messages.write"
  | "audit.read"
  | "calculations.read"
  | "calculations.write"
  | "calculations.settings"
  | "inventory.read"
  | "inventory.write"
  | "inventory.reserve"
  | "monteur.own"
  | "customer.own";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    "tenant.manage",
    "users.manage",
    "customers.read",
    "customers.write",
    "orders.read",
    "orders.write",
    "orders.assign",
    "appointments.read",
    "appointments.write",
    "employees.read",
    "employees.write",
    "services.read",
    "services.write",
    "checklists.read",
    "checklists.write",
    "messages.read",
    "messages.write",
    "audit.read",
    "calculations.read",
    "calculations.write",
    "calculations.settings",
    "inventory.read",
    "inventory.write",
    "inventory.reserve",
  ],
  MEISTER: [
    "customers.read",
    "customers.write",
    "orders.read",
    "orders.write",
    "orders.assign",
    "appointments.read",
    "appointments.write",
    "employees.read",
    "employees.write",
    "services.read",
    "services.write",
    "checklists.read",
    "checklists.write",
    "messages.read",
    "messages.write",
    "audit.read",
    "calculations.read",
    "calculations.write",
    "calculations.settings",
    "inventory.read",
    "inventory.write",
    "inventory.reserve",
  ],
  BUERO: [
    "customers.read",
    "customers.write",
    "orders.read",
    "orders.write",
    "orders.assign",
    "appointments.read",
    "appointments.write",
    "employees.read",
    "employees.write",
    "services.read",
    "services.write",
    "checklists.read",
    "checklists.write",
    "messages.read",
    "messages.write",
    "calculations.read",
    "calculations.write",
    "calculations.settings",
    "inventory.read",
    "inventory.write",
    "inventory.reserve",
  ],
  MONTEUR: [
    "orders.read",
    "appointments.read",
    "monteur.own",
    "messages.read",
    "messages.write",
    "customers.read",
    "employees.read",
    "inventory.read",
    "inventory.write",
    "inventory.reserve",
  ],
  KUNDE: ["customer.own"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessDashboard(role: UserRole): boolean {
  return role !== "KUNDE";
}

export function canAccessMonteurApp(role: UserRole): boolean {
  return role === "MONTEUR" || role === "MEISTER" || role === "ADMIN";
}

export function canManageOrders(role: UserRole): boolean {
  return hasPermission(role, "orders.write");
}

/** Navigation: `permission: null` = für alle Dashboard-Rollen sichtbar */
export const DASHBOARD_NAV_CONFIG: {
  href: string;
  label: string;
  permission: Permission | null;
}[] = [
  { href: "/dashboard", label: "Übersicht", permission: null },
  { href: "/dashboard/auftraege", label: "Aufträge", permission: "orders.read" },
  { href: "/dashboard/termine", label: "Termine", permission: "appointments.read" },
  { href: "/dashboard/inventar", label: "Inventar", permission: "inventory.read" },
  { href: "/dashboard/einkauf", label: "Einkauf", permission: "inventory.read" },
  { href: "/dashboard/disposition", label: "Disposition", permission: "appointments.read" },
  { href: "/dashboard/kalkulation", label: "Kalkulation", permission: "calculations.read" },
  { href: "/dashboard/kunden", label: "Kunden", permission: "customers.read" },
  { href: "/dashboard/mitarbeiter", label: "Mitarbeiter", permission: "employees.read" },
  { href: "/dashboard/leistungen", label: "Leistungen", permission: "services.read" },
  { href: "/dashboard/maschinen", label: "Maschinen", permission: "calculations.settings" },
  { href: "/dashboard/nachrichten", label: "Nachrichten", permission: "messages.read" },
  { href: "/dashboard/stundenzettel", label: "Stundenzettel", permission: "monteur.own" },
];

/** Monteur: gleiche Dashboard-Ansicht wie Admin, ohne diese Bereiche */
const MONTEUR_EXCLUDED_NAV = new Set([
  "/dashboard/einkauf",
  "/dashboard/disposition",
  "/dashboard/kalkulation",
  "/dashboard/maschinen",
  "/dashboard/leistungen",
]);

export function getDashboardNavItems(role: UserRole) {
  return DASHBOARD_NAV_CONFIG.filter((item) => {
    if (role === "MONTEUR" && MONTEUR_EXCLUDED_NAV.has(item.href)) return false;
    return item.permission === null || hasPermission(role, item.permission);
  });
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
