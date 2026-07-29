import { UserRole } from "@/generated/prisma/enums";

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
  | "invitations.manage"
  | "shared.read"
  | "audit.read"
  | "calculations.read"
  | "calculations.write"
  | "calculations.settings"
  | "invoices.read"
  | "invoices.write"
  | "invoices.payments"
  | "notifications.manage"
  | "inventory.read"
  | "inventory.write"
  | "inventory.reserve"
  | "monteur.own"
  | "monteur.create_own"
  | "customer.own"
  | "ai.chat"
  | "time_entries.read"
  | "time_entries.approve";

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
    "invitations.manage",
    "audit.read",
    "calculations.read",
    "calculations.write",
    "calculations.settings",
    "invoices.read",
    "invoices.write",
    "invoices.payments",
    "notifications.manage",
    "inventory.read",
    "inventory.write",
    "inventory.reserve",
    "monteur.own",
    "ai.chat",
    "time_entries.read",
    "time_entries.approve",
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
    "invitations.manage",
    "audit.read",
    "calculations.read",
    "calculations.write",
    "calculations.settings",
    "invoices.read",
    "invoices.write",
    "invoices.payments",
    "notifications.manage",
    "inventory.read",
    "inventory.write",
    "inventory.reserve",
    "monteur.own",
    "ai.chat",
    "time_entries.read",
    "time_entries.approve",
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
    "invitations.manage",
    "calculations.read",
    "calculations.write",
    "calculations.settings",
    "invoices.read",
    "invoices.write",
    "invoices.payments",
    "notifications.manage",
    "inventory.read",
    "inventory.write",
    "inventory.reserve",
    "monteur.own",
    "ai.chat",
    "time_entries.read",
    "time_entries.approve",
  ],
  MONTEUR: [
    "monteur.own",
    "monteur.create_own",
    "messages.read",
    "messages.write",
    "inventory.read",
    "ai.chat",
  ],
  KUNDE: ["customer.own"],
  GAST: ["shared.read", "messages.read", "messages.write"],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function canAccessDashboard(role: UserRole): boolean {
  return role !== "KUNDE" && role !== "GAST";
}

export function canAccessMonteurApp(role: UserRole): boolean {
  return role === "MONTEUR" || role === "MEISTER" || role === "ADMIN";
}

/** Eingeladene Gäste nutzen ein eigenes, schlankes Portal. */
export function canAccessGuestPortal(role: UserRole): boolean {
  return role === "GAST";
}

export function canAccessCustomerPortal(role: UserRole): boolean {
  return role === "KUNDE";
}

export { getRoleHomePath } from "@/lib/role-routing";

export function canManageOrders(role: UserRole): boolean {
  return hasPermission(role, "orders.write");
}

/** Navigation: `permission: null` = für alle Dashboard-Rollen sichtbar */
export type NavSection =
  | "betrieb"
  | "material"
  | "finanzen"
  | "stammdaten"
  | "einstellungen"
  | null;

export const NAV_SECTION_LABELS: Record<Exclude<NavSection, null>, string> = {
  betrieb: "Betrieb",
  material: "Material",
  finanzen: "Finanzen",
  stammdaten: "Stammdaten",
  einstellungen: "Einstellungen",
};

export const DASHBOARD_NAV_CONFIG: {
  href: string;
  label: string;
  permission: Permission | null;
  section: NavSection;
}[] = [
  { href: "/dashboard", label: "Übersicht", permission: null, section: "betrieb" },
  { href: "/dashboard/auftraege", label: "Aufträge", permission: "orders.read", section: "betrieb" },
  { href: "/dashboard/projekte", label: "Projekte", permission: "orders.read", section: "betrieb" },
  { href: "/dashboard/termine", label: "Termine", permission: "appointments.read", section: "betrieb" },
  { href: "/dashboard/disposition", label: "Disposition", permission: "appointments.read", section: "betrieb" },
  { href: "/dashboard/stundenzettel", label: "Stundenzettel", permission: "monteur.own", section: "betrieb" },
  { href: "/dashboard/stunden", label: "Team-Stunden", permission: "time_entries.read", section: "betrieb" },
  { href: "/dashboard/inventar", label: "Inventar", permission: "inventory.read", section: "material" },
  { href: "/dashboard/einkauf", label: "Einkauf", permission: "inventory.read", section: "material" },
  { href: "/dashboard/kalkulation", label: "Kalkulation", permission: "calculations.read", section: "finanzen" },
  { href: "/dashboard/rechnungen", label: "Rechnungen", permission: "invoices.read", section: "finanzen" },
  { href: "/dashboard/umsatz", label: "Umsatzübersicht", permission: "invoices.read", section: "finanzen" },
  { href: "/dashboard/finanzuebersicht", label: "Finanzübersicht", permission: "invoices.read", section: "finanzen" },
  { href: "/dashboard/kunden", label: "Kunden", permission: "customers.read", section: "stammdaten" },
  { href: "/dashboard/mitarbeiter", label: "Mitarbeiter", permission: "employees.read", section: "stammdaten" },
  { href: "/dashboard/leistungen", label: "Leistungen", permission: "services.read", section: "stammdaten" },
  { href: "/dashboard/maschinen", label: "Maschinen", permission: "calculations.settings", section: "stammdaten" },
  { href: "/dashboard/einstellungen/betrieb", label: "Betrieb", permission: "tenant.manage", section: "einstellungen" },
  { href: "/dashboard/einstellungen/rechnung", label: "Rechnungseinstellungen", permission: "calculations.settings", section: "einstellungen" },
  { href: "/dashboard/einstellungen/benachrichtigungen", label: "Benachrichtigungen", permission: "notifications.manage", section: "einstellungen" },
  { href: "/dashboard/einstellungen/sicherheit", label: "Sicherheit & Datenschutz", permission: "tenant.manage", section: "einstellungen" },
  { href: "/dashboard/einstellungen/system", label: "Systemstatus", permission: "notifications.manage", section: "einstellungen" },
  { href: "/dashboard/ki-assistent", label: "Betriebsassistent", permission: "ai.chat", section: null },
  { href: "/dashboard/profil", label: "Profil", permission: null, section: null },
  { href: "/dashboard/nachrichten", label: "Nachrichten", permission: "messages.read", section: null },
];

/** Monteur: gleiche Dashboard-Ansicht wie Admin, ohne diese Bereiche */
export const MONTEUR_EXCLUDED_DASHBOARD_PREFIXES = [
  "/dashboard/auftraege",
  "/dashboard/projekte",
  "/dashboard/termine",
  "/dashboard/kunden",
  "/dashboard/mitarbeiter",
  "/dashboard/inventar",
  "/dashboard/einkauf",
  "/dashboard/disposition",
  "/dashboard/kalkulation",
  "/dashboard/rechnungen",
  "/dashboard/umsatz",
  "/dashboard/finanzuebersicht",
  "/dashboard/maschinen",
  "/dashboard/leistungen",
  "/dashboard/einstellungen/rechnung",
  "/dashboard/einstellungen/benachrichtigungen",
] as const;

const MONTEUR_EXCLUDED_NAV = new Set<string>(MONTEUR_EXCLUDED_DASHBOARD_PREFIXES);

export function isMonteurExcludedDashboardPath(pathname: string): boolean {
  return MONTEUR_EXCLUDED_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getDashboardNavItems(role: UserRole) {
  return DASHBOARD_NAV_CONFIG.filter((item) => {
    if (role === "MONTEUR" && MONTEUR_EXCLUDED_NAV.has(item.href)) return false;
    return item.permission === null || hasPermission(role, item.permission);
  });
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}
