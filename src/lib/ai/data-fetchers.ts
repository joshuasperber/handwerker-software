import { endOfDay, startOfDay, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";
import { orderServiceLabel, formatDate, formatDateTime, formatSlotLabel, ORDER_STATUS_LABELS } from "@/lib/utils";
import { getFinanceOverview } from "@/lib/finance/overview";
import type { AiIntent, PersonMatch } from "./types";
import { hasPermission } from "@/lib/permissions";
import {
  buildOrderAccessFilter,
  canReadCustomers,
  canReadEmployees,
  canReadFinance,
  canReadInventory,
  canReadInvoices,
  canReadOrders,
  enforceMonteurSelfQuery,
} from "./access-control";

function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function matchesName(
  firstName: string,
  lastName: string,
  search: string
): boolean {
  const tokens = nameTokens(search);
  const full = `${firstName} ${lastName}`.toLowerCase();
  const first = firstName.toLowerCase();
  const last = lastName.toLowerCase();

  if (tokens.length === 0) return false;
  if (full.includes(search.toLowerCase())) return true;
  if (tokens.length === 1) {
    return first.includes(tokens[0]) || last.includes(tokens[0]) || tokens[0].includes(first);
  }
  return tokens.every(
    (t) => first.includes(t) || last.includes(t) || full.includes(t)
  );
}

export async function findPersonMatches(
  auth: SessionUser,
  name: string
): Promise<PersonMatch[]> {
  const matches: PersonMatch[] = [];

  if (canReadEmployees(auth)) {
    const employees = await prisma.user.findMany({
      where: {
        tenantId: auth.tenantId,
        isActive: true,
        role: { in: ["ADMIN", "MEISTER", "BUERO", "MONTEUR"] },
        employee: { isNot: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    for (const e of employees) {
      if (matchesName(e.firstName, e.lastName, name)) {
        matches.push({
          type: "employee",
          id: e.id,
          firstName: e.firstName,
          lastName: e.lastName,
          label: `${e.firstName} ${e.lastName} (Mitarbeiter)`,
          role: e.role,
          email: e.email,
          phone: e.phone,
        });
      }
    }
  } else if (auth.role === "MONTEUR") {
    matches.push({
      type: "employee",
      id: auth.id,
      firstName: auth.firstName,
      lastName: auth.lastName,
      label: `${auth.firstName} ${auth.lastName} (Mitarbeiter)`,
      role: auth.role,
      email: auth.email,
    });
  }

  if (canReadCustomers(auth)) {
    const customers = await prisma.customer.findMany({
      where: { tenantId: auth.tenantId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        company: true,
      },
    });

    for (const c of customers) {
      if (matchesName(c.firstName, c.lastName, name)) {
        matches.push({
          type: "customer",
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          label: `${c.firstName} ${c.lastName}${c.company ? ` (${c.company})` : ""} (Kunde)`,
          email: c.email,
          phone: c.phone,
        });
      }
    }
  }

  return matches;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MEISTER: "Meister",
  BUERO: "Büro",
  MONTEUR: "Monteur",
};

export async function fetchEmployeeList(auth: SessionUser) {
  if (!canReadEmployees(auth)) {
    if (auth.role === "MONTEUR") {
      return {
        employees: [
          {
            firstName: auth.firstName,
            lastName: auth.lastName,
            email: auth.email,
            phone: null as string | null,
            role: auth.role,
            qualifications: [] as string[],
          },
        ],
      };
    }
    return { error: "Keine Berechtigung für Mitarbeiterdaten." };
  }

  const users = await prisma.user.findMany({
    where: {
      tenantId: auth.tenantId,
      isActive: true,
      role: { in: ["ADMIN", "MEISTER", "BUERO", "MONTEUR"] },
      employee: { isNot: null },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      role: true,
      employee: {
        select: {
          qualifications: { select: { name: true } },
        },
      },
    },
  });

  return {
    employees: users.map((u) => ({
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      phone: u.phone,
      role: ROLE_LABELS[u.role] ?? u.role,
      qualifications: u.employee?.qualifications.map((q) => q.name) ?? [],
    })),
  };
}

export async function fetchCustomerList(auth: SessionUser) {
  if (!canReadCustomers(auth)) {
    return { error: "Keine Berechtigung für Kundendaten." };
  }

  const customers = await prisma.customer.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 50,
    select: {
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      company: true,
      _count: { select: { orders: true } },
    },
  });

  return { customers };
}

export async function fetchPersonDetails(
  auth: SessionUser,
  match: PersonMatch
) {
  if (match.type === "employee") {
    const user = await prisma.user.findFirst({
      where: { id: match.id, tenantId: auth.tenantId },
      include: {
        employee: {
          include: {
            teamMemberships: { include: { team: true } },
            appointments: {
              where: { startTime: { gte: new Date() } },
              take: 5,
              orderBy: { startTime: "asc" },
              include: {
                order: {
                  include: {
                    customer: true,
                    property: true,
                  },
                },
              },
            },
          },
        },
      },
    });
    return { type: "employee" as const, user };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: match.id, tenantId: auth.tenantId },
    include: {
      properties: true,
      orders: {
        take: 10,
        orderBy: { createdAt: "desc" },
        include: {
          property: true,
          appointments: { take: 1, orderBy: { startTime: "desc" } },
        },
      },
    },
  });

  let openInvoices: Array<{ documentNumber: string; grossAmount: number; status: string }> = [];
  if (canReadInvoices(auth)) {
    const docs = await prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        status: { in: ["OFFEN", "TEILBEZAHLT"] },
        calculation: { customerId: match.id, tenantId: auth.tenantId },
      },
      select: { documentNumber: true, grossAmount: true, status: true },
      take: 10,
    });
    openInvoices = docs;
  }

  return { type: "customer" as const, customer, openInvoices };
}

async function resolveEmployeeByName(auth: SessionUser, name?: string) {
  if (!name) return null;
  const matches = await findPersonMatches(auth, name);
  const employees = matches.filter((m) => m.type === "employee");
  if (employees.length === 1) return employees[0];
  if (employees.length === 0) return null;
  return employees[0];
}

export async function fetchEmployeeOrders(
  auth: SessionUser,
  intent: AiIntent
) {
  const employee = await resolveEmployeeByName(auth, intent.personName);
  if (!employee) {
    return { error: `Ich habe keinen Mitarbeiter mit dem Namen „${intent.personName ?? ""}" gefunden.` };
  }

  const access = await enforceMonteurSelfQuery(auth, intent.personName, employee.id);
  if (!access.allowed) {
    return { error: access.reason };
  }

  const from = intent.date ? startOfDay(intent.date) : startOfDay(new Date());
  const to = intent.dateEnd ? endOfDay(intent.dateEnd) : endOfDay(from);

  const emp = await prisma.employee.findFirst({
    where: { userId: employee.id, tenantId: auth.tenantId },
  });
  if (!emp) return { error: "Kein Mitarbeiterprofil gefunden." };

  const orderFilter = await buildOrderAccessFilter(auth);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      employeeId: emp.id,
      startTime: { gte: from, lte: to },
      order: orderFilter,
    },
    orderBy: { startTime: "asc" },
    include: {
      order: {
        include: {
          customer: true,
          property: true,
          services: { include: { service: true } },
          team: true,
        },
      },
    },
  });

  return { employee, appointments, from, to };
}

export async function fetchEmployeeMaterials(
  auth: SessionUser,
  intent: AiIntent
) {
  const schedule = await fetchEmployeeOrders(auth, intent);
  if ("error" in schedule) return schedule;

  const { employee, appointments, from, to } = schedule;
  const orderIds = appointments.map((a) => a.orderId);

  const materialLines = orderIds.length
    ? await prisma.orderMaterialLine.findMany({
        where: { orderId: { in: orderIds } },
        include: { article: true },
      })
    : [];

  const serviceMaterials = orderIds.length
    ? await prisma.orderService.findMany({
        where: { orderId: { in: orderIds } },
        include: {
          service: {
            include: {
              materialTemplates: { include: { article: true } },
            },
          },
        },
      })
    : [];

  let stockInfo: Array<{ name: string; required: number; onHand: number; unit: string }> = [];
  if (canReadInventory(auth)) {
    const articleIds = [
      ...materialLines.map((l) => l.articleId).filter(Boolean),
      ...serviceMaterials.flatMap((os) =>
        os.service?.materialTemplates.map((t) => t.articleId).filter(Boolean) ?? []
      ),
    ] as string[];

    if (articleIds.length) {
      const balances = await prisma.stockBalance.groupBy({
        by: ["articleId"],
        where: { articleId: { in: articleIds } },
        _sum: { onHandQuantity: true },
      });
      const balanceMap = new Map(balances.map((b) => [b.articleId, b._sum.onHandQuantity ?? 0]));

      for (const line of materialLines) {
        stockInfo.push({
          name: line.name,
          required: line.quantityRequired,
          onHand: line.articleId ? (balanceMap.get(line.articleId) ?? 0) : 0,
          unit: line.unit,
        });
      }
    }
  }

  return { employee, appointments, materialLines, serviceMaterials, stockInfo, from, to };
}

export async function searchOrders(auth: SessionUser, term: string) {
  if (!canReadOrders(auth)) {
    return { error: "Keine Berechtigung für Auftragsdaten." };
  }

  const orderFilter = await buildOrderAccessFilter(auth);
  const q = term.trim();

  const orders = await prisma.order.findMany({
    where: {
      ...orderFilter,
      OR: [
        { title: { contains: q, mode: "insensitive" } },
        { description: { contains: q, mode: "insensitive" } },
        { internalNotes: { contains: q, mode: "insensitive" } },
        { customerNotes: { contains: q, mode: "insensitive" } },
        { orderNumber: { contains: q, mode: "insensitive" } },
        {
          customer: {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { company: { contains: q, mode: "insensitive" } },
            ],
          },
        },
        {
          services: {
            some: {
              OR: [
                { customName: { contains: q, mode: "insensitive" } },
                { description: { contains: q, mode: "insensitive" } },
                { service: { name: { contains: q, mode: "insensitive" } } },
              ],
            },
          },
        },
        {
          materialLines: {
            some: { name: { contains: q, mode: "insensitive" } },
          },
        },
      ],
    },
    take: 15,
    orderBy: { updatedAt: "desc" },
    include: {
      customer: true,
      property: true,
      services: { include: { service: true } },
      appointments: {
        where: { startTime: { gte: new Date() } },
        take: 1,
        orderBy: { startTime: "asc" },
        include: { employee: { include: { user: true } } },
      },
      materialLines: true,
      team: true,
    },
  });

  return { orders, term: q };
}

export async function fetchOpenInvoices(auth: SessionUser) {
  if (!canReadInvoices(auth)) {
    return { error: "Keine Berechtigung für Rechnungsdaten." };
  }

  const invoices = await prisma.calculationDocument.findMany({
    where: {
      documentType: "INVOICE",
      status: { in: ["OFFEN", "TEILBEZAHLT"] },
      calculation: { tenantId: auth.tenantId },
    },
    include: {
      calculation: { include: { customer: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 30,
  });

  return { invoices };
}

export async function fetchMissingReceipts(auth: SessionUser) {
  if (!canReadFinance(auth)) {
    return { error: "Keine Berechtigung für Finanzdaten." };
  }

  const from = auth.role === "MONTEUR"
    ? startOfMonth(new Date())
    : startOfMonth(new Date());
  const to = endOfMonth(new Date());

  const expenses = await prisma.expense.findMany({
    where: {
      tenantId: auth.tenantId,
      expenseDate: { gte: from, lte: to },
      receiptStorageKey: null,
    },
    orderBy: { expenseDate: "desc" },
    take: 30,
  });

  return { expenses, from, to };
}

export async function fetchProfitAnalysis(auth: SessionUser) {
  if (!canReadFinance(auth)) {
    return { error: "Keine Berechtigung für Finanzdaten." };
  }

  const overview = await getFinanceOverview(auth.tenantId, { preset: "current_month" });
  const prevMonth = subMonths(new Date(), 1);
  const prevOverview = await getFinanceOverview(auth.tenantId, {
    preset: "custom",
    from: startOfMonth(prevMonth).toISOString(),
    to: endOfMonth(prevMonth).toISOString(),
  });

  return {
    overview,
    prevOverview,
    warnings: overview.warnings,
  };
}

export async function fetchMaterialShortage(auth: SessionUser, intent: AiIntent) {
  if (!canReadInventory(auth)) {
    return { error: "Keine Berechtigung für Inventardaten." };
  }

  const from = intent.date ?? startOfDay(new Date());
  const to = intent.dateEnd ?? endOfDay(from);

  const orderFilter = await buildOrderAccessFilter(auth);
  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      startTime: { gte: from, lte: to },
      order: orderFilter,
    },
    include: {
      order: {
        include: {
          materialLines: { include: { article: true } },
          services: {
            include: {
              service: { include: { materialTemplates: { include: { article: true } } } },
            },
          },
        },
      },
    },
  });

  const needs = new Map<string, { name: string; required: number; unit: string; articleId?: string }>();

  for (const appt of appointments) {
    for (const line of appt.order.materialLines) {
      const key = line.articleId ?? line.name;
      const existing = needs.get(key) ?? { name: line.name, required: 0, unit: line.unit, articleId: line.articleId ?? undefined };
      existing.required += line.quantityRequired;
      needs.set(key, existing);
    }
    for (const os of appt.order.services) {
      for (const tmpl of os.service?.materialTemplates ?? []) {
        const key = tmpl.articleId ?? tmpl.name;
        const existing = needs.get(key) ?? {
          name: tmpl.name,
          required: 0,
          unit: tmpl.unit,
          articleId: tmpl.articleId ?? undefined,
        };
        existing.required += tmpl.defaultQuantity;
        needs.set(key, existing);
      }
    }
  }

  const shortages: Array<{ name: string; required: number; onHand: number; unit: string }> = [];
  for (const need of needs.values()) {
    let onHand = 0;
    if (need.articleId) {
      const balances = await prisma.stockBalance.aggregate({
        where: { articleId: need.articleId },
        _sum: { onHandQuantity: true },
      });
      onHand = balances._sum.onHandQuantity ?? 0;
    }
    if (need.required > onHand) {
      shortages.push({ name: need.name, required: need.required, onHand, unit: need.unit });
    }
  }

  return { shortages, appointmentCount: appointments.length, from, to };
}

export async function fetchMachineUsage(auth: SessionUser) {
  const canSeeMachines =
    hasPermission(auth.role, "calculations.settings") ||
    hasPermission(auth.role, "inventory.read");

  if (!canSeeMachines) {
    return { error: "Keine Berechtigung für Maschinendaten." };
  }

  const machines = await prisma.machine.findMany({
    where: { tenantId: auth.tenantId, isActive: true },
    include: {
      usageItems: {
        orderBy: { createdAt: "desc" },
        take: 5,
      },
    },
  });

  const longRunning = machines.filter((m) => m.usageItems.length >= 3);

  return { machines, longRunning };
}

export async function fetchTeamSchedule(auth: SessionUser, intent: AiIntent) {
  if (!canReadOrders(auth)) {
    return { error: "Keine Berechtigung für Dispositionsdaten." };
  }

  const teamName = intent.teamName;
  if (!teamName) {
    return { error: "Bitte gib an, welches Team gemeint ist (z. B. „Team 1“)." };
  }

  const teams = await prisma.team.findMany({
    where: {
      tenantId: auth.tenantId,
      isActive: true,
      name: { contains: teamName, mode: "insensitive" },
    },
  });

  if (teams.length === 0) {
    return { error: `Ich habe kein Team mit dem Namen „${teamName}" gefunden.` };
  }

  const team = teams[0];
  const from = intent.date ? startOfDay(intent.date) : startOfDay(new Date());
  const to = intent.dateEnd ? endOfDay(intent.dateEnd) : endOfDay(from);

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      startTime: { gte: from, lte: to },
      order: { teamId: team.id },
    },
    orderBy: { startTime: "asc" },
    include: {
      order: { include: { customer: true, property: true } },
      employee: { include: { user: true } },
    },
  });

  return { team, appointments, from, to };
}
