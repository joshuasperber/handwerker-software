import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError } from "@/lib/api";
import { resolveFinancePeriod } from "@/lib/finance/period";
import type { FinancePeriodPreset } from "@/lib/finance/types";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_PAYMENT_STATUS_LABELS,
  INVESTMENT_CATEGORY_LABELS,
  INVESTMENT_STATUS_LABELS,
} from "@/lib/finance/types";
import { getOrCreateFinanceSettings } from "@/lib/finance/settings";

function csvEscape(value: string | number | null | undefined): string {
  const s = value == null ? "" : String(value);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(rows: Array<Array<string | number | null | undefined>>): string {
  return rows.map((r) => r.map(csvEscape).join(";")).join("\n");
}

/**
 * Steuerberater-Export (CSV) — keine automatische Übertragung an Drittanbieter.
 * GET ?preset=&from=&to=&section=expenses|investments|invoices|all
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const preset = (searchParams.get("preset") ?? "current_month") as FinancePeriodPreset;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const section = searchParams.get("section") ?? "all";

  const period = resolveFinancePeriod(preset, from, to);
  const settings = await getOrCreateFinanceSettings(auth.tenantId);

  const parts: string[] = [];
  parts.push(
    [
      "# JoMaster Steuerberater-Export",
      `# Zeitraum: ${period.label}`,
      `# Einnahmenbasis: ${settings.revenueBasis}`,
      "# Unverbindliche Datenausgabe — keine Steuerberatung.",
      "",
    ].join("\n")
  );

  if (section === "all" || section === "expenses") {
    const expenses = await prisma.expense.findMany({
      where: {
        tenantId: auth.tenantId,
        expenseDate: { gte: period.from, lte: period.to },
      },
      orderBy: { expenseDate: "asc" },
    });
    parts.push("## Ausgaben");
    parts.push(
      toCsv([
        [
          "Datum",
          "Kategorie",
          "Beschreibung",
          "Netto",
          "USt",
          "Brutto",
          "Status",
          "Lieferant",
          "Beleg",
          "Investition",
          "Notiz",
        ],
        ...expenses.map((e) => [
          e.expenseDate.toISOString().slice(0, 10),
          EXPENSE_CATEGORY_LABELS[e.category],
          e.description,
          e.netAmount.toFixed(2),
          e.vatAmount.toFixed(2),
          e.grossAmount.toFixed(2),
          EXPENSE_PAYMENT_STATUS_LABELS[e.paymentStatus],
          e.supplier,
          e.receiptStorageKey ? "ja" : "nein",
          e.isInvestment ? "ja" : "nein",
          e.internalNote,
        ]),
      ])
    );
    parts.push("");
  }

  if (section === "all" || section === "investments") {
    const investments = await prisma.plannedInvestment.findMany({
      where: { tenantId: auth.tenantId },
      include: {
        machine: { select: { name: true } },
        article: { select: { name: true } },
        project: { select: { name: true } },
      },
      orderBy: { plannedDate: "asc" },
    });
    parts.push("## Geplante Investitionen");
    parts.push(
      toCsv([
        [
          "Titel",
          "Betrag",
          "Datum",
          "Kategorie",
          "Status",
          "Notiz",
          "Maschine",
          "Material",
          "Projekt",
        ],
        ...investments.map((i) => [
          i.title,
          i.plannedAmount.toFixed(2),
          i.plannedDate ? i.plannedDate.toISOString().slice(0, 10) : "",
          INVESTMENT_CATEGORY_LABELS[i.category],
          INVESTMENT_STATUS_LABELS[i.status],
          i.note,
          i.machine?.name ?? "",
          i.article?.name ?? "",
          i.project?.name ?? "",
        ]),
      ])
    );
    parts.push("");
  }

  if (section === "all" || section === "invoices") {
    const invoices = await prisma.calculationDocument.findMany({
      where: {
        documentType: "INVOICE",
        calculation: { tenantId: auth.tenantId },
        issueDate: { gte: period.from, lte: period.to },
      },
      include: {
        calculation: { include: { customer: true } },
      },
      orderBy: { issueDate: "asc" },
    });
    parts.push("## Rechnungen (nach Rechnungsdatum)");
    parts.push(
      toCsv([
        [
          "Nummer",
          "Rechnungsdatum",
          "Status",
          "Kunde",
          "Netto",
          "USt",
          "Brutto",
          "Bezahlt",
        ],
        ...invoices.map((d) => {
          const c = d.calculation.customer;
          const name = c
            ? [c.company, `${c.firstName} ${c.lastName}`].filter(Boolean).join(" / ")
            : "";
          return [
            d.documentNumber,
            d.issueDate.toISOString().slice(0, 10),
            d.status,
            name,
            d.netAmount.toFixed(2),
            d.vatAmount.toFixed(2),
            d.grossAmount.toFixed(2),
            d.paidAmount.toFixed(2),
          ];
        }),
      ])
    );
  }

  const body = parts.join("\n");
  const filename = `jomaster-finanzexport-${period.from.toISOString().slice(0, 10)}.csv`;

  return new Response("\uFEFF" + body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
