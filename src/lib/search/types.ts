import type { Permission } from "@/lib/permissions";

export const SEARCH_CATEGORIES = [
  "employees",
  "customers",
  "orders",
  "appointments",
  "projects",
  "services",
  "machines",
  "inventory",
] as const;

export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export const SEARCH_CATEGORY_META: Record<
  SearchCategory,
  { label: string; hrefList: string; permission: Permission | null; basePriority: number }
> = {
  employees: {
    label: "Mitarbeiter",
    hrefList: "/dashboard/mitarbeiter",
    permission: "employees.read",
    basePriority: 100,
  },
  customers: {
    label: "Kunden",
    hrefList: "/dashboard/kunden",
    permission: "customers.read",
    basePriority: 95,
  },
  orders: {
    label: "Aufträge",
    hrefList: "/dashboard/auftraege",
    permission: "orders.read",
    basePriority: 80,
  },
  appointments: {
    label: "Termine",
    hrefList: "/dashboard/termine",
    permission: "appointments.read",
    basePriority: 70,
  },
  projects: {
    label: "Projekte",
    hrefList: "/dashboard/projekte",
    permission: "orders.read",
    basePriority: 60,
  },
  services: {
    label: "Leistungen",
    hrefList: "/dashboard/leistungen",
    permission: "services.read",
    basePriority: 40,
  },
  machines: {
    label: "Maschinen",
    hrefList: "/dashboard/maschinen",
    permission: "calculations.settings",
    basePriority: 35,
  },
  inventory: {
    label: "Inventar",
    hrefList: "/dashboard/inventar",
    permission: "inventory.read",
    basePriority: 30,
  },
};

export type SearchHit = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle: string | null;
  href: string;
  score: number;
};

export type SearchGroup = {
  category: SearchCategory;
  label: string;
  score: number;
  hits: SearchHit[];
};

export type SearchResult = {
  query: string;
  groups: SearchGroup[];
  topCategories: SearchCategory[];
  moreCategories: SearchCategory[];
  totalHits: number;
};
