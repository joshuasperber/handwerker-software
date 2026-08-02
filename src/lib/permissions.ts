import { UserRole } from "@/generated/prisma/enums";

export type Permission =
  | "tenant.manage"
  | "users.manage"
  | "roles.manage"
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
  | "time_entries.approve"
  | "work_requests.create"
  | "work_requests.manage"
  /** Darf die Verwaltungsansicht (/dashboard) nutzen. */
  | "views.management"
  /** Darf die Arbeitsansicht (/monteur) nutzen. */
  | "views.work";

/** Rollen, die primär die Arbeitsansicht (/monteur) nutzen — ohne Verwaltungszugriff. */
export const FIELD_ROLES: UserRole[] = ["MONTEUR", "TEAMLEITER", "AUSHILFE"];

/** Rollen mit Verwaltungszugriff (/dashboard). */
export const OFFICE_ROLES: UserRole[] = ["ADMIN", "BUERO", "MEISTER"];

const FIELD_BASE: Permission[] = [
  "views.work",
  "monteur.own",
  "monteur.create_own",
  "appointments.read",
  "messages.read",
  "messages.write",
  "inventory.read",
  "ai.chat",
  "work_requests.create",
];

const OFFICE_VIEW: Permission[] = ["views.management", "views.work"];

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  ADMIN: [
    ...OFFICE_VIEW,
    "tenant.manage",
    "users.manage",
    "roles.manage",
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
    "monteur.create_own",
    "ai.chat",
    "time_entries.read",
    "time_entries.approve",
    "work_requests.create",
    "work_requests.manage",
  ],
  /** Legacy „Meister“ — weiterhin starke Büro-/Feldrechte. */
  MEISTER: [
    ...OFFICE_VIEW,
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
    "monteur.create_own",
    "ai.chat",
    "time_entries.read",
    "time_entries.approve",
    "work_requests.create",
    "work_requests.manage",
  ],
  TEAMLEITER: [
    ...FIELD_BASE,
    "orders.read",
    "appointments.read",
    "employees.read",
    "time_entries.read",
    "time_entries.approve",
    "inventory.reserve",
  ],
  BUERO: [
    ...OFFICE_VIEW,
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
    "monteur.create_own",
    "ai.chat",
    "time_entries.read",
    "time_entries.approve",
    "work_requests.create",
    "work_requests.manage",
  ],
  MONTEUR: [...FIELD_BASE],
  AUSHILFE: [
    "views.work",
    "monteur.own",
    "appointments.read",
    "messages.read",
    "messages.write",
    "work_requests.create",
  ],
  KUNDE: ["customer.own"],
  GAST: ["shared.read", "messages.read", "messages.write"],
};

export type PermissionContext = {
  canManageRoles?: boolean | null;
};

export function hasPermission(
  role: UserRole,
  permission: Permission,
  ctx?: PermissionContext
): boolean {
  if (permission === "roles.manage") {
    if (role === "ADMIN") return true;
    if (role === "BUERO" && ctx?.canManageRoles) return true;
    return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
  }
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

/** @deprecated Nutze canAccessManagementView — Feldrollen haben keinen Dashboard-Zugang mehr. */
export function canAccessDashboard(role: UserRole): boolean {
  return canAccessManagementView(role);
}

/** Verwaltungsansicht (/dashboard) — Admin, Büro, Meister. */
export function canAccessManagementView(role: UserRole): boolean {
  return hasPermission(role, "views.management");
}

/** Arbeitsansicht (/monteur) — Feldrollen + Office zum bewussten Wechsel. */
export function canAccessWorkView(role: UserRole): boolean {
  return hasPermission(role, "views.work");
}

/** @deprecated Alias für canAccessWorkView */
export function canAccessMonteurApp(role: UserRole): boolean {
  return canAccessWorkView(role);
}

/** Startet standardmäßig in der Arbeitsansicht (kein Verwaltungszugriff). */
export function prefersFieldHome(role: UserRole): boolean {
  return canAccessWorkView(role) && !canAccessManagementView(role);
}

/**
 * Bewusster Wechsel zwischen Verwaltung und Arbeit.
 * Nur Nutzer mit beiden Ansichten — nicht Monteur/Teamleiter/Aushilfe.
 */
export function canSwitchAppViews(role: UserRole): boolean {
  return canAccessManagementView(role) && canAccessWorkView(role);
}

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
  { href: "/dashboard/eingang", label: "Eingangsbox", permission: "work_requests.manage", section: "betrieb" },
  // Stundenzettel in der Verwaltung nur für Office (eigene Zeiten im Büro) — nicht als Sprungbrett zur Arbeit.
  { href: "/dashboard/stundenzettel", label: "Stundenzettel", permission: "time_entries.read", section: "betrieb" },
  { href: "/dashboard/stunden", label: "Team-Stunden", permission: "time_entries.read", section: "betrieb" },
  { href: "/dashboard/inventar", label: "Inventar", permission: "inventory.read", section: "material" },
  { href: "/dashboard/einkauf", label: "Einkauf", permission: "inventory.read", section: "material" },
  { href: "/dashboard/kalkulation", label: "Kalkulation", permission: "calculations.read", section: "finanzen" },
  { href: "/dashboard/rechnungen", label: "Rechnungen", permission: "invoices.read", section: "finanzen" },
  { href: "/dashboard/umsatz", label: "Umsatzübersicht", permission: "invoices.read", section: "finanzen" },
  { href: "/dashboard/finanzuebersicht", label: "Finanzübersicht", permission: "invoices.read", section: "finanzen" },
  { href: "/dashboard/kunden", label: "Kunden", permission: "customers.read", section: "stammdaten" },
  { href: "/dashboard/mitarbeiter", label: "Mitarbeiter", permission: "employees.read", section: "stammdaten" },
  { href: "/dashboard/rollen", label: "Rollen & Rechte", permission: "roles.manage", section: "stammdaten" },
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

/** Feldrollen: Verwaltungs-Dashboard stark eingeschränkt. */
export const FIELD_EXCLUDED_DASHBOARD_PREFIXES = [
  "/dashboard/auftraege",
  "/dashboard/projekte",
  "/dashboard/termine",
  "/dashboard/kunden",
  "/dashboard/mitarbeiter",
  "/dashboard/rollen",
  "/dashboard/eingang",
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

/** @deprecated use FIELD_EXCLUDED_DASHBOARD_PREFIXES */
export const MONTEUR_EXCLUDED_DASHBOARD_PREFIXES = FIELD_EXCLUDED_DASHBOARD_PREFIXES;

const FIELD_EXCLUDED_NAV = new Set<string>(FIELD_EXCLUDED_DASHBOARD_PREFIXES);

export function isMonteurExcludedDashboardPath(pathname: string): boolean {
  return FIELD_EXCLUDED_DASHBOARD_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export function getDashboardNavItems(role: UserRole, ctx?: PermissionContext) {
  // Feldrollen sehen die Verwaltungs-Navigation nicht (kein leeres Admin-Menü).
  if (!canAccessManagementView(role)) return [];

  return DASHBOARD_NAV_CONFIG.filter((item) => {
    if (item.permission === null) return true;
    return hasPermission(role, item.permission, ctx);
  });
}

export function getPermissions(role: UserRole): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

/** Rollen, die Mitarbeitern zugewiesen werden können. */
export const ASSIGNABLE_STAFF_ROLES: UserRole[] = [
  "MONTEUR",
  "TEAMLEITER",
  "AUSHILFE",
  "BUERO",
  "MEISTER",
  "ADMIN",
];
