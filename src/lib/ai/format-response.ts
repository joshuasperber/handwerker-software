import { formatDate, formatDateTime, formatSlotLabel, ORDER_STATUS_LABELS, orderServiceLabel } from "@/lib/utils";
import type { AiChatResult, AiIntent, PersonMatch } from "./types";

export function formatHelpResponse(): AiChatResult {
  return {
    content: `Ich bin dein Betriebsassistent und arbeite nur mit Daten aus deiner App — ich erfinde nichts.

**Beispielanfragen:**
• „Zeig mir alle Mitarbeiter" — Mitarbeiterliste
• „Zeig mir alle Kunden" — Kundenliste
• „Zeig mir Anton." — Mitarbeiter oder Kunde finden
• „Welche Aufträge hat Anton am 26. Juli?" — Termine eines Mitarbeiters
• „Was muss Anton am 26. Juli mitnehmen?" — Mitnahmeliste
• „Aufträge mit Tür anbringen" — Auftragssuche
• „Welche Kunden haben offene Rechnungen?"
• „Welche Belege fehlen diesen Monat?"
• „Warum ist der Gewinn diesen Monat so hoch?"
• „Welche Termine hat Team 1 morgen?"

Wenn ich etwas nicht finde, sage ich das klar. Meine Empfehlungen sind Hinweise — keine verbindliche Beratung.`,
    intent: "help",
    dataSources: [],
    confidence: "high",
  };
}

export function formatEmployeeList(data: {
  employees: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    role: string;
    qualifications: string[];
  }>;
}): AiChatResult {
  const { employees } = data;

  if (employees.length === 0) {
    return {
      content: "In der App sind derzeit keine aktiven Mitarbeiter hinterlegt.",
      intent: "list_employees",
      dataSources: [{ type: "employees", count: 0, label: "Mitarbeiter" }],
      confidence: "high",
    };
  }

  let content = `**${employees.length} Mitarbeiter** in der App:\n\n`;
  for (const e of employees) {
    content += `• **${e.firstName} ${e.lastName}** — ${e.role}\n`;
    content += `  E-Mail: ${e.email}`;
    if (e.phone) content += ` · Tel: ${e.phone}`;
    content += "\n";
    if (e.qualifications.length) {
      content += `  Qualifikationen: ${e.qualifications.join(", ")}\n`;
    }
  }

  return {
    content: content.trim(),
    intent: "list_employees",
    dataSources: [{ type: "employees", count: employees.length, label: "Mitarbeiter" }],
    confidence: "high",
  };
}

export function formatCustomerList(data: {
  customers: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
    _count: { orders: number };
  }>;
}): AiChatResult {
  const { customers } = data;

  if (customers.length === 0) {
    return {
      content: "In der App sind derzeit keine Kunden hinterlegt.",
      intent: "list_customers",
      dataSources: [{ type: "customers", count: 0, label: "Kunden" }],
      confidence: "high",
    };
  }

  let content = `**${customers.length} Kunde${customers.length === 1 ? "" : "n"}** in der App`;
  if (customers.length >= 50) content += " (max. 50 angezeigt)";
  content += ":\n\n";

  for (const c of customers) {
    content += `• **${c.firstName} ${c.lastName}**`;
    if (c.company) content += ` (${c.company})`;
    content += `\n  E-Mail: ${c.email}`;
    if (c.phone) content += ` · Tel: ${c.phone}`;
    content += ` · ${c._count.orders} Auftrag${c._count.orders === 1 ? "" : "e"}\n`;
  }

  return {
    content: content.trim(),
    intent: "list_customers",
    dataSources: [{ type: "customers", count: customers.length, label: "Kunden" }],
    confidence: "high",
  };
}

export function formatDisambiguation(
  matches: PersonMatch[],
  personName: string
): AiChatResult {
  const lines = matches.map((m, i) => `${i + 1}. ${m.label}`).join("\n");
  return {
    content: `Ich habe mehrere Treffer für „${personName}" gefunden:\n\n${lines}\n\nBitte präzisiere deine Anfrage, z. B. „Zeig mir ${matches[0].firstName} ${matches[0].lastName} als ${matches[0].type === "employee" ? "Mitarbeiter" : "Kunde"}".`,
    intent: "disambiguation",
    dataSources: [{ type: "person_matches", count: matches.length, label: "Personen-Treffer" }],
    confidence: "high",
    disambiguationOptions: matches,
  };
}

export function formatPersonLookup(
  data: Awaited<ReturnType<typeof import("./data-fetchers").fetchPersonDetails>>
): AiChatResult {
  if (data.type === "employee" && data.user) {
    const u = data.user;
    const teams = u.employee?.teamMemberships.map((tm) => tm.team.name).join(", ") || "—";
    const appts = u.employee?.appointments ?? [];

    let content = `Ich habe **${u.firstName} ${u.lastName}** als Mitarbeiter gefunden.\n\n`;
    content += `• **Rolle:** ${u.role}\n`;
    content += `• **E-Mail:** ${u.email}\n`;
    if (u.phone) content += `• **Telefon:** ${u.phone}\n`;
    content += `• **Teams:** ${teams}\n`;

    if (appts.length) {
      content += `\n**Anstehende Termine (${appts.length}):**\n`;
      for (const a of appts) {
        const label = a.order
          ? `${a.order.customer.firstName} ${a.order.customer.lastName}, ${a.order.property.street}, ${a.order.property.city} (${ORDER_STATUS_LABELS[a.order.status] ?? a.order.status})`
          : (a.title ?? "Termin");
        content += `• ${formatDateTime(a.startTime)} — ${label}\n`;
      }
    } else {
      content += `\nKeine anstehenden Termine gefunden.`;
    }

    return {
      content,
      intent: "person_lookup",
      dataSources: [
        { type: "employee", count: 1, label: "Mitarbeiter" },
        { type: "appointments", count: appts.length, label: "Termine" },
      ],
      confidence: "high",
    };
  }

  if (data.type === "customer" && data.customer) {
    const c = data.customer;
    let content = `Ich habe **${c.firstName} ${c.lastName}** als Kunden gefunden.\n\n`;
    content += `• **E-Mail:** ${c.email}\n`;
    if (c.phone) content += `• **Telefon:** ${c.phone}\n`;
    if (c.company) content += `• **Firma:** ${c.company}\n`;

    if (c.properties.length) {
      content += `\n**Objekte:**\n`;
      for (const p of c.properties) {
        content += `• ${p.label}: ${p.street}, ${p.zipCode} ${p.city}\n`;
      }
    }

    if (c.orders.length) {
      content += `\n**Aufträge (${c.orders.length}):**\n`;
      for (const o of c.orders.slice(0, 8)) {
        content += `• ${o.orderNumber} — ${ORDER_STATUS_LABELS[o.status] ?? o.status}, ${o.property.street}, ${o.property.city}\n`;
      }
    } else {
      content += `\nKeine Aufträge gefunden.`;
    }

    if (data.openInvoices.length) {
      content += `\n**Offene Rechnungen:**\n`;
      for (const inv of data.openInvoices) {
        content += `• ${inv.documentNumber}: ${inv.grossAmount.toFixed(2)} € (${inv.status})\n`;
      }
    }

    return {
      content,
      intent: "person_lookup",
      dataSources: [
        { type: "customer", count: 1, label: "Kunde" },
        { type: "orders", count: c.orders.length, label: "Aufträge" },
        { type: "invoices", count: data.openInvoices.length, label: "Offene Rechnungen" },
      ],
      confidence: "high",
    };
  }

  return {
    content: "Keine passenden Daten gefunden.",
    intent: "person_lookup",
    dataSources: [],
    confidence: "low",
  };
}

export function formatEmployeeOrders(data: {
  employee: PersonMatch;
  appointments: Array<{
    startTime: Date;
    endTime: Date;
    order: {
      orderNumber: string;
      title: string | null;
      status: string;
      customer: { firstName: string; lastName: string };
      property: { street: string; zipCode: string; city: string };
      services: Array<{ service?: { name: string } | null; customName?: string | null }>;
      team?: { name: string } | null;
    };
  }>;
  from: Date;
  to: Date;
}): AiChatResult {
  const { employee, appointments, from, to } = data;

  if (appointments.length === 0) {
    return {
      content: `Für **${employee.firstName} ${employee.lastName}** wurden zwischen ${formatDate(from)} und ${formatDate(to)} keine Termine gefunden.`,
      intent: "employee_orders",
      dataSources: [{ type: "appointments", count: 0, label: "Termine" }],
      confidence: "high",
      missingData: ["Keine Termine im Zeitraum"],
    };
  }

  let content = `**Termine für ${employee.firstName} ${employee.lastName}** (${formatDate(from)}${from.getTime() !== to.getTime() ? ` – ${formatDate(to)}` : ""}):\n\n`;

  for (const a of appointments) {
    const o = a.order;
    const services = o.services.map((s) => orderServiceLabel(s)).join(", ") || "—";
    content += `**${formatSlotLabel(a.startTime, a.endTime)}**\n`;
    content += `• Auftrag: ${o.orderNumber}${o.title ? ` — ${o.title}` : ""}\n`;
    content += `• Kunde: ${o.customer.firstName} ${o.customer.lastName}\n`;
    content += `• Adresse: ${o.property.street}, ${o.property.zipCode} ${o.property.city}\n`;
    content += `• Status: ${ORDER_STATUS_LABELS[o.status] ?? o.status}\n`;
    content += `• Leistungen: ${services}\n`;
    if (o.team) content += `• Team: ${o.team.name}\n`;
    content += "\n";
  }

  return {
    content: content.trim(),
    intent: "employee_orders",
    dataSources: [{ type: "appointments", count: appointments.length, label: "Termine" }],
    confidence: "high",
  };
}

export function formatEmployeeMaterials(data: {
  employee: PersonMatch;
  appointments: Array<{
    startTime: Date;
    endTime: Date;
    order: {
      id: string;
      internalNotes: string | null;
      customer: { firstName: string; lastName: string };
      property: { street: string; city: string };
    };
  }>;
  materialLines: Array<{
    orderId: string;
    name: string;
    quantityRequired: number;
    unit: string;
    isTool: boolean;
  }>;
  serviceMaterials: Array<{
    orderId: string;
    service?: {
      materialTemplates: Array<{
        name: string;
        defaultQuantity: number;
        unit: string;
        isTool: boolean;
      }>;
    } | null;
  }>;
  stockInfo: Array<{ name: string; required: number; onHand: number; unit: string }>;
  from: Date;
  to: Date;
}): AiChatResult {
  const { employee, appointments, materialLines, serviceMaterials, stockInfo, from, to } = data;

  if (appointments.length === 0) {
    return {
      content: `Für **${employee.firstName} ${employee.lastName}** am ${formatDate(from)} wurden keine Termine gefunden.`,
      intent: "employee_materials",
      dataSources: [],
      confidence: "high",
      missingData: ["Keine Termine"],
    };
  }

  let content = `**Mitnahmeliste für ${employee.firstName} ${employee.lastName}** (${formatDate(from)}):\n\n`;

  for (const a of appointments) {
    const o = a.order;
    content += `### ${formatSlotLabel(a.startTime, a.endTime)} — ${o.customer.firstName} ${o.customer.lastName}\n`;
    content += `Adresse: ${o.property.street}, ${o.property.city}\n`;

    const orderMaterials = materialLines.filter((m) => m.orderId === o.id);
    const orderServices = serviceMaterials.filter((s) => s.orderId === o.id);

    if (orderMaterials.length) {
      content += `\n**Material (Auftrag):**\n`;
      for (const m of orderMaterials) {
        content += `• ${m.quantityRequired} ${m.unit} ${m.name}${m.isTool ? " (Werkzeug)" : ""}\n`;
      }
    }

    const tmplMaterials = orderServices.flatMap((os) => os.service?.materialTemplates ?? []);
    if (tmplMaterials.length) {
      content += `\n**Material (Leistungszuordnung):**\n`;
      for (const t of tmplMaterials) {
        content += `• ${t.defaultQuantity} ${t.unit} ${t.name}${t.isTool ? " (Werkzeug)" : ""}\n`;
      }
    }

    if (!orderMaterials.length && !tmplMaterials.length) {
      content += `\n_Für diesen Auftrag sind noch keine Materialien hinterlegt._\n`;
    }

    if (o.internalNotes) content += `\nHinweis: ${o.internalNotes}\n`;
    content += "\n";
  }

  const missingData: string[] = [];
  if (materialLines.length === 0 && serviceMaterials.every((s) => !s.service?.materialTemplates.length)) {
    missingData.push("Keine Materialpositionen hinterlegt");
  }

  if (stockInfo.length) {
    content += `\n**Bestandsprüfung:**\n`;
    for (const s of stockInfo) {
      const status = s.onHand >= s.required ? "✓ ausreichend" : `⚠ nur ${s.onHand} von ${s.required} ${s.unit}`;
      content += `• ${s.name}: ${status}\n`;
    }
  }

  return {
    content: content.trim(),
    intent: "employee_materials",
    dataSources: [
      { type: "appointments", count: appointments.length, label: "Termine" },
      { type: "materials", count: materialLines.length + serviceMaterials.length, label: "Materialpositionen" },
    ],
    confidence: missingData.length ? "medium" : "high",
    missingData: missingData.length ? missingData : undefined,
  };
}

export function formatOrderSearch(data: {
  orders: Array<{
    orderNumber: string;
    status: string;
    customer: { firstName: string; lastName: string };
    property: { street: string; city: string };
    services: Array<{ service?: { name: string } | null; customName?: string | null }>;
    appointments: Array<{
      startTime: Date;
      employee?: { user?: { firstName: string; lastName: string } | null } | null;
    }>;
    materialLines: Array<{ quantityRequired: number; unit: string; name: string }>;
  }>;
  term: string;
}): AiChatResult {
  const { orders, term } = data;

  if (orders.length === 0) {
    return {
      content: `Ich habe keine Aufträge zum Begriff „${term}" gefunden.`,
      intent: "order_search",
      dataSources: [{ type: "orders", count: 0, label: "Aufträge" }],
      confidence: "high",
    };
  }

  let content = `**${orders.length} Auftrag${orders.length === 1 ? "" : "e"}** zum Begriff „${term}":\n\n`;

  for (const o of orders) {
    const services = o.services.map((s) => orderServiceLabel(s)).join(", ") || "—";
    const nextAppt = o.appointments[0];
    content += `**${o.orderNumber}** — ${o.customer.firstName} ${o.customer.lastName}\n`;
    content += `• Adresse: ${o.property.street}, ${o.property.city}\n`;
    content += `• Status: ${ORDER_STATUS_LABELS[o.status] ?? o.status}\n`;
    content += `• Leistungen: ${services}\n`;
    if (nextAppt) {
      const emp = nextAppt.employee?.user;
      content += `• Nächster Termin: ${formatDateTime(nextAppt.startTime)}`;
      if (emp) content += ` (${emp.firstName} ${emp.lastName})`;
      content += "\n";
    }
    if (o.materialLines.length) {
      content += `• Material: ${o.materialLines.map((m) => `${m.quantityRequired} ${m.unit} ${m.name}`).join(", ")}\n`;
    }
    content += "\n";
  }

  return {
    content: content.trim(),
    intent: "order_search",
    dataSources: [{ type: "orders", count: orders.length, label: "Aufträge" }],
    confidence: "high",
  };
}

export function formatOpenInvoices(data: {
  invoices: Array<{
    grossAmount: number;
    paidAmount: number;
    calculation: { customer?: { firstName: string; lastName: string } | null };
  }>;
}): AiChatResult {
  const { invoices } = data;

  if (invoices.length === 0) {
    return {
      content: "Es gibt derzeit keine offenen Rechnungen.",
      intent: "open_invoices",
      dataSources: [{ type: "invoices", count: 0, label: "Rechnungen" }],
      confidence: "high",
    };
  }

  const byCustomer = new Map<string, typeof invoices>();
  for (const inv of invoices) {
    const c = inv.calculation.customer;
    const key = c ? `${c.firstName} ${c.lastName}` : "Unbekannt";
    const list = byCustomer.get(key) ?? [];
    list.push(inv);
    byCustomer.set(key, list);
  }

  let content = `**${byCustomer.size} Kunde${byCustomer.size === 1 ? "" : "n"}** mit offenen Rechnungen:\n\n`;
  for (const [name, invs] of byCustomer) {
    const total = invs.reduce((s, i) => s + (i.grossAmount - i.paidAmount), 0);
    content += `• **${name}** — ${invs.length} Rechnung${invs.length === 1 ? "" : "en"}, offen: ${total.toFixed(2)} €\n`;
  }

  content += `\n_Basierend auf ${invoices.length} offenen Rechnungen in der App._`;

  return {
    content,
    intent: "open_invoices",
    dataSources: [{ type: "invoices", count: invoices.length, label: "Offene Rechnungen" }],
    confidence: "high",
  };
}

export function formatMissingReceipts(data: {
  expenses: Array<{ expenseDate: Date; description: string; grossAmount: number }>;
  from: Date;
  to: Date;
}): AiChatResult {
  const { expenses, from, to } = data;

  if (expenses.length === 0) {
    return {
      content: `Für ${formatDate(from)} – ${formatDate(to)} sind alle erfassten Ausgaben mit Belegen hinterlegt.`,
      intent: "missing_receipts",
      dataSources: [{ type: "expenses", count: 0, label: "Ausgaben ohne Beleg" }],
      confidence: "high",
    };
  }

  let content = `**${expenses.length} Ausgabe${expenses.length === 1 ? "" : "n"}** ohne Beleg (${formatDate(from)} – ${formatDate(to)}):\n\n`;
  for (const e of expenses.slice(0, 15)) {
    content += `• ${formatDate(e.expenseDate)} — ${e.description}: ${e.grossAmount.toFixed(2)} €\n`;
  }

  return {
    content,
    intent: "missing_receipts",
    dataSources: [{ type: "expenses", count: expenses.length, label: "Ausgaben ohne Beleg" }],
    confidence: "high",
  };
}

export function formatProfitAnalysis(data: {
  overview: import("@/lib/finance/types").FinanceOverview;
  prevOverview: import("@/lib/finance/types").FinanceOverview;
  warnings: import("@/lib/finance/types").FinanceWarning[];
}): AiChatResult {
  const { overview, prevOverview, warnings } = data;
  const profit = overview.profit.estimatedNet;
  const prev = prevOverview.profit.estimatedNet;

  let content = `**Gewinneinschätzung (${overview.period.label}):**\n\n`;
  content += `• Einnahmen (netto): ${overview.revenue.net.toFixed(2)} €\n`;
  content += `• Ausgaben (netto): ${overview.expenses.net.toFixed(2)} €\n`;
  content += `• Geschätzter Gewinn: ${profit.toFixed(2)} €\n`;
  content += `• Vormonat: ${prev.toFixed(2)} €\n`;

  if (warnings.length) {
    content += `\n**Hinweise:**\n`;
    for (const w of warnings) {
      content += `• ${w.message}\n`;
    }
  }

  content += `\n_Diese Einschätzung basiert auf erfassten Rechnungen und Ausgaben. Keine verbindliche Steuerberatung._`;

  const missingData: string[] = [];
  if (overview.expenses.withoutReceipt > 0) {
    missingData.push("Nicht alle Belege hinterlegt");
  }

  return {
    content,
    intent: "profit_analysis",
    dataSources: [
      { type: "invoices", count: overview.invoices.openCount, label: "Rechnungen" },
      { type: "expenses", count: overview.expenses.count, label: "Ausgaben" },
    ],
    confidence: missingData.length ? "medium" : "high",
    missingData: missingData.length ? missingData : undefined,
  };
}

export function formatMaterialShortage(data: {
  shortages: Array<{ name: string; required: number; onHand: number; unit: string }>;
  appointmentCount: number;
  from: Date;
  to: Date;
}): AiChatResult {
  const { shortages, appointmentCount, from, to } = data;

  if (shortages.length === 0) {
    return {
      content: appointmentCount === 0
        ? `Für ${formatDate(from)} – ${formatDate(to)} sind keine geplanten Termine hinterlegt.`
        : `Für ${appointmentCount} geplante Termine in der kommenden Periode sind keine Materialengpässe erkennbar (basierend auf hinterlegten Materialdaten und Bestand).`,
      intent: "material_shortage",
      dataSources: [{ type: "appointments", count: appointmentCount, label: "Termine" }],
      confidence: appointmentCount ? "medium" : "low",
      missingData: appointmentCount ? undefined : ["Keine Termine geplant"],
    };
  }

  let content = `**Materialengpässe** (${formatDate(from)} – ${formatDate(to)}, ${appointmentCount} Termine):\n\n`;
  for (const s of shortages) {
    content += `• **${s.name}**: benötigt ${s.required} ${s.unit}, Bestand ${s.onHand} ${s.unit} — bitte Nachbestellung prüfen\n`;
  }
  content += `\n_Empfehlung basierend auf geplanten Aufträgen und aktuellem Bestand. Ich bestelle nicht automatisch._`;

  return {
    content,
    intent: "material_shortage",
    dataSources: [
      { type: "appointments", count: appointmentCount, label: "Termine" },
      { type: "materials", count: shortages.length, label: "Engpässe" },
    ],
    confidence: "high",
  };
}

export function formatMachineUsage(data: {
  machines: Array<{ name: string; usageItems: unknown[] }>;
  longRunning: Array<{ name: string; usageItems: unknown[] }>;
}): AiChatResult {
  const { machines, longRunning } = data;

  if (machines.length === 0) {
    return {
      content: "Es sind keine aktiven Maschinen hinterlegt.",
      intent: "machine_usage",
      dataSources: [],
      confidence: "high",
    };
  }

  let content = `**Maschinenübersicht** (${machines.length} aktiv):\n\n`;

  if (longRunning.length) {
    content += `**Häufig genutzt / prüfen:**\n`;
    for (const m of longRunning) {
      content += `• **${m.name}** — ${m.usageItems.length} Einsätze in Kalkulationen. Bitte prüfe, ob Wartung, Ersatz oder Neuanschaffung wirtschaftlich sinnvoll sein könnten.\n`;
    }
  } else {
    content += "Keine Maschine mit auffällig hoher Nutzungshistorie gefunden.\n";
  }

  return {
    content,
    intent: "machine_usage",
    dataSources: [{ type: "machines", count: machines.length, label: "Maschinen" }],
    confidence: "medium",
  };
}

export function formatTeamSchedule(data: {
  team: { name: string };
  appointments: Array<{
    startTime: Date;
    endTime: Date;
    order: {
      customer: { firstName: string; lastName: string };
      property: { street: string };
    };
    employee?: { user?: { firstName: string; lastName: string } | null } | null;
  }>;
  from: Date;
  to: Date;
}): AiChatResult {
  const { team, appointments, from, to } = data;

  if (appointments.length === 0) {
    return {
      content: `Für **${team.name}** wurden zwischen ${formatDate(from)} und ${formatDate(to)} keine Termine gefunden.`,
      intent: "team_schedule",
      dataSources: [{ type: "appointments", count: 0, label: "Termine" }],
      confidence: "high",
    };
  }

  let content = `**Termine für ${team.name}** (${formatDate(from)}${from.getTime() !== to.getTime() ? ` – ${formatDate(to)}` : ""}):\n\n`;
  for (const a of appointments) {
    const emp = a.employee?.user;
    content += `• ${formatSlotLabel(a.startTime, a.endTime)} — ${a.order.customer.firstName} ${a.order.customer.lastName}, ${a.order.property.street}`;
    if (emp) content += ` (${emp.firstName} ${emp.lastName})`;
    content += "\n";
  }

  return {
    content,
    intent: "team_schedule",
    dataSources: [{ type: "appointments", count: appointments.length, label: "Termine" }],
    confidence: "high",
  };
}

export function formatUnknown(intent: AiIntent): AiChatResult {
  return {
    content: `Ich konnte deine Anfrage „${intent.rawMessage}" nicht eindeutig zuordnen.

Versuche z. B.:
• „Zeig mir [Name]"
• „Aufträge mit [Begriff]"
• „Was muss [Name] am [Datum] mitnehmen?"
• „Offene Rechnungen"

Tippe **Hilfe** für weitere Beispiele.`,
    intent: "unknown",
    dataSources: [],
    confidence: "low",
  };
}

export function formatError(message: string, intent: AiIntent["type"] = "unknown"): AiChatResult {
  return {
    content: message,
    intent,
    dataSources: [],
    confidence: "high",
  };
}
