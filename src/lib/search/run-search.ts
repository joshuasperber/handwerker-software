import { prisma } from "@/lib/prisma";
import { hasPermission, type Permission } from "@/lib/permissions";
import { queryVariants } from "./normalize";
import { MIN_MATCH_SCORE, scoreMatch } from "./fuzzy";
import {
  SEARCH_CATEGORIES,
  SEARCH_CATEGORY_META,
  type SearchCategory,
  type SearchHit,
  type SearchGroup,
  type SearchResult,
} from "./types";

export type {
  SearchCategory,
  SearchHit,
  SearchGroup,
  SearchResult,
} from "./types";
export { SEARCH_CATEGORIES, SEARCH_CATEGORY_META } from "./types";

function orContains(variants: string[], fields: string[]) {
  const clauses: Array<Record<string, unknown>> = [];
  for (const v of variants) {
    for (const field of fields) {
      clauses.push({ [field]: { contains: v, mode: "insensitive" } });
    }
  }
  return clauses;
}

function takeTop(hits: SearchHit[], limit = 8): SearchHit[] {
  return hits
    .filter((h) => h.score >= MIN_MATCH_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function runGlobalSearch(input: {
  tenantId: string;
  role: string;
  query: string;
}): Promise<SearchResult> {
  const query = input.query.trim();
  if (!query || query.length < 1) {
    return { query, groups: [], topCategories: [], moreCategories: [], totalHits: 0 };
  }

  const variants = queryVariants(query);
  const can = (perm: Permission | null) =>
    !perm || hasPermission(input.role as never, perm);

  const tasks: Array<Promise<SearchHit[]>> = [];

  if (can(SEARCH_CATEGORY_META.employees.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.employee.findMany({
          where: {
            tenantId: input.tenantId,
            OR: [
              { user: { firstName: { contains: variants[0]!, mode: "insensitive" } } },
              { user: { lastName: { contains: variants[0]!, mode: "insensitive" } } },
              { user: { email: { contains: variants[0]!, mode: "insensitive" } } },
              ...variants.slice(1).flatMap((v) => [
                { user: { firstName: { contains: v, mode: "insensitive" as const } } },
                { user: { lastName: { contains: v, mode: "insensitive" as const } } },
              ]),
            ],
          },
          include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
          take: 40,
          orderBy: { updatedAt: "desc" },
        });
        // Fuzzy-Nachschlag: bei wenigen Treffern auch kürzere Prefix-Suche
        let candidates = rows;
        if (candidates.length < 5 && query.length >= 2) {
          const prefix = query.slice(0, Math.min(3, query.length));
          const extra = await prisma.employee.findMany({
            where: {
              tenantId: input.tenantId,
              OR: [
                { user: { firstName: { contains: prefix, mode: "insensitive" } } },
                { user: { lastName: { contains: prefix, mode: "insensitive" } } },
              ],
            },
            include: {
              user: { select: { firstName: true, lastName: true, email: true, role: true } },
            },
            take: 60,
          });
          const seen = new Set(candidates.map((c) => c.id));
          candidates = [...candidates, ...extra.filter((e) => !seen.has(e.id))];
        }
        return takeTop(
          candidates.map((e) => {
            const name = `${e.user.firstName} ${e.user.lastName}`.trim();
            const score = scoreMatch(query, name, e.user.firstName, e.user.lastName, e.user.email);
            return {
              id: e.id,
              category: "employees" as const,
              title: name,
              subtitle: e.user.email,
              href: `/dashboard/mitarbeiter?q=${encodeURIComponent(name)}`,
              score,
            };
          })
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  if (can(SEARCH_CATEGORY_META.customers.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.customer.findMany({
          where: {
            tenantId: input.tenantId,
            OR: orContains(variants, [
              "firstName",
              "lastName",
              "email",
              "company",
              "phone",
              "contactPerson",
            ]) as never,
          },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            company: true,
            phone: true,
            contactPerson: true,
          },
          take: 40,
          orderBy: { updatedAt: "desc" },
        });
        let candidates = rows;
        if (candidates.length < 5 && query.length >= 2) {
          const prefix = query.slice(0, Math.min(3, query.length));
          const extra = await prisma.customer.findMany({
            where: {
              tenantId: input.tenantId,
              OR: orContains([prefix], ["firstName", "lastName", "company"]) as never,
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              company: true,
              phone: true,
              contactPerson: true,
            },
            take: 60,
          });
          const seen = new Set(candidates.map((c) => c.id));
          candidates = [...candidates, ...extra.filter((e) => !seen.has(e.id))];
        }
        return takeTop(
          candidates.map((c) => {
            const name = `${c.firstName} ${c.lastName}`.trim();
            const score = scoreMatch(
              query,
              name,
              c.firstName,
              c.lastName,
              c.company,
              c.email,
              c.phone,
              c.contactPerson
            );
            return {
              id: c.id,
              category: "customers" as const,
              title: c.company?.trim() ? `${c.company} (${name})` : name,
              subtitle: c.email || c.phone || null,
              href: `/dashboard/kunden/${c.id}`,
              score,
            };
          })
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  if (can(SEARCH_CATEGORY_META.orders.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.order.findMany({
          where: {
            tenantId: input.tenantId,
            OR: [
              ...orContains(variants, ["orderNumber", "title", "description", "orderTypeLabel"]),
              {
                customer: {
                  OR: orContains(variants, ["firstName", "lastName", "company"]),
                },
              },
            ] as never,
          },
          select: {
            id: true,
            orderNumber: true,
            title: true,
            status: true,
            customer: { select: { firstName: true, lastName: true, company: true } },
          },
          take: 40,
          orderBy: { updatedAt: "desc" },
        });
        return takeTop(
          rows.map((o) => {
            const customerName = o.customer.company?.trim()
              ? o.customer.company
              : `${o.customer.firstName} ${o.customer.lastName}`.trim();
            const score = scoreMatch(
              query,
              o.orderNumber,
              o.title,
              customerName,
              o.customer.firstName,
              o.customer.lastName
            );
            return {
              id: o.id,
              category: "orders" as const,
              title: o.title ? `${o.orderNumber} · ${o.title}` : o.orderNumber,
              subtitle: customerName,
              href: `/dashboard/auftraege/${o.id}`,
              score,
            };
          })
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  if (can(SEARCH_CATEGORY_META.appointments.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.appointment.findMany({
          where: {
            tenantId: input.tenantId,
            OR: [
              ...orContains(variants, ["notes"]),
              {
                order: {
                  OR: [
                    ...orContains(variants, ["orderNumber", "title"]),
                    {
                      customer: {
                        OR: orContains(variants, ["firstName", "lastName", "company"]),
                      },
                    },
                  ],
                },
              },
              {
                employee: {
                  user: {
                    OR: [
                      { firstName: { contains: variants[0]!, mode: "insensitive" } },
                      { lastName: { contains: variants[0]!, mode: "insensitive" } },
                    ],
                  },
                },
              },
            ] as never,
          },
          select: {
            id: true,
            startTime: true,
            endTime: true,
            notes: true,
            title: true,
            orderId: true,
            order: {
              select: {
                orderNumber: true,
                title: true,
                customer: { select: { firstName: true, lastName: true, company: true } },
              },
            },
            employee: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
          take: 40,
          orderBy: { startTime: "desc" },
        });
        return takeTop(
          rows.map((a) => {
            const customerName = a.order?.customer.company?.trim()
              ? a.order.customer.company
              : a.order
                ? `${a.order.customer.firstName} ${a.order.customer.lastName}`.trim()
                : null;
            const employeeName = a.employee
              ? `${a.employee.user.firstName} ${a.employee.user.lastName}`.trim()
              : null;
            const when = a.startTime.toLocaleString("de-DE", {
              dateStyle: "short",
              timeStyle: "short",
            });
            const title =
              a.title?.trim() ||
              (a.order
                ? `${a.order.orderNumber}${a.order.title ? ` · ${a.order.title}` : ""}`
                : "Termin");
            const score = scoreMatch(
              query,
              a.order?.orderNumber,
              a.order?.title,
              a.title,
              customerName,
              employeeName,
              a.notes
            );
            return {
              id: a.id,
              category: "appointments" as const,
              title,
              subtitle: [when, employeeName, customerName].filter(Boolean).join(" · "),
              href: a.orderId ? `/dashboard/auftraege/${a.orderId}` : "/dashboard/termine",
              score,
            };
          })
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  if (can(SEARCH_CATEGORY_META.projects.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.project.findMany({
          where: {
            tenantId: input.tenantId,
            OR: [
              ...orContains(variants, [
                "name",
                "description",
                "addressStreet",
                "addressCity",
              ]),
              {
                customer: {
                  OR: orContains(variants, ["firstName", "lastName", "company"]),
                },
              },
            ] as never,
          },
          select: {
            id: true,
            name: true,
            status: true,
            addressCity: true,
            customer: { select: { firstName: true, lastName: true, company: true } },
          },
          take: 40,
          orderBy: { updatedAt: "desc" },
        });
        return takeTop(
          rows.map((p) => {
            const customerName = p.customer.company?.trim()
              ? p.customer.company
              : `${p.customer.firstName} ${p.customer.lastName}`.trim();
            const score = scoreMatch(query, p.name, customerName, p.addressCity);
            return {
              id: p.id,
              category: "projects" as const,
              title: p.name,
              subtitle: [customerName, p.addressCity].filter(Boolean).join(" · ") || null,
              href: `/dashboard/projekte/${p.id}`,
              score,
            };
          })
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  if (can(SEARCH_CATEGORY_META.services.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.service.findMany({
          where: {
            tenantId: input.tenantId,
            isActive: true,
            OR: orContains(variants, ["name", "description"]) as never,
          },
          select: { id: true, name: true, description: true, durationMinutes: true },
          take: 30,
          orderBy: { sortOrder: "asc" },
        });
        return takeTop(
          rows.map((s) => ({
            id: s.id,
            category: "services" as const,
            title: s.name,
            subtitle: s.description?.slice(0, 80) ?? `${s.durationMinutes} Min.`,
            href: `/dashboard/leistungen/${s.id}`,
            score: scoreMatch(query, s.name, s.description),
          }))
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  if (can(SEARCH_CATEGORY_META.machines.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.machine.findMany({
          where: {
            tenantId: input.tenantId,
            isActive: true,
            OR: orContains(variants, ["name", "machineType"]) as never,
          },
          select: { id: true, name: true, machineType: true },
          take: 30,
          orderBy: { name: "asc" },
        });
        return takeTop(
          rows.map((m) => ({
            id: m.id,
            category: "machines" as const,
            title: m.name,
            subtitle: m.machineType,
            href: `/dashboard/maschinen`,
            score: scoreMatch(query, m.name, m.machineType),
          }))
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  if (can(SEARCH_CATEGORY_META.inventory.permission)) {
    tasks.push(
      (async () => {
        const rows = await prisma.article.findMany({
          where: {
            tenantId: input.tenantId,
            isActive: true,
            OR: orContains(variants, ["name", "sku", "category", "supplierName", "description"]) as never,
          },
          select: { id: true, name: true, sku: true, category: true, unit: true },
          take: 40,
          orderBy: { name: "asc" },
        });
        return takeTop(
          rows.map((a) => ({
            id: a.id,
            category: "inventory" as const,
            title: a.name,
            subtitle: [a.sku, a.category, a.unit].filter(Boolean).join(" · ") || null,
            href: `/dashboard/inventar?q=${encodeURIComponent(a.name)}`,
            score: scoreMatch(query, a.name, a.sku, a.category),
          }))
        );
      })()
    );
  } else tasks.push(Promise.resolve([]));

  const [
    employees,
    customers,
    orders,
    appointments,
    projects,
    services,
    machines,
    inventory,
  ] = await Promise.all(tasks);

  const byCategory: Record<SearchCategory, SearchHit[]> = {
    employees,
    customers,
    orders,
    appointments,
    projects,
    services,
    machines,
    inventory,
  };

  const groups: SearchGroup[] = SEARCH_CATEGORIES.map((category) => {
    const hits = byCategory[category];
    const meta = SEARCH_CATEGORY_META[category];
    const bestHit = hits[0]?.score ?? 0;
    return {
      category,
      label: meta.label,
      score: hits.length ? meta.basePriority + bestHit : 0,
      hits,
    };
  })
    .filter((g) => g.hits.length > 0)
    .sort((a, b) => b.score - a.score);

  const topCategories = groups.slice(0, 3).map((g) => g.category);
  const moreCategories = groups.slice(3).map((g) => g.category);

  return {
    query,
    groups,
    topCategories,
    moreCategories,
    totalHits: groups.reduce((s, g) => s + g.hits.length, 0),
  };
}
