import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api";
import type { DocumentSnapshot } from "@/lib/documents/snapshot";

function deDecimal(n: number): string {
  return n.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

function csvField(v: string | number): string {
  const s = String(v);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function csvRow(fields: (string | number)[]): string {
  return fields.map(csvField).join(";");
}

/** Erlöskonto (SKR03) je USt-Satz – ggf. an Kontenrahmen des Steuerberaters anpassen. */
function revenueAccount(vatPercent: number): string {
  if (Math.round(vatPercent) === 19) return "8400";
  if (Math.round(vatPercent) === 7) return "8300";
  return "8200";
}

function csvResponse(content: string, filename: string): Response {
  return new Response("\uFEFF" + content, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

export async function GET(request: Request) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") ?? "journal";
  const year = new Date().getFullYear();
  const from = searchParams.get("from")
    ? new Date(searchParams.get("from")!)
    : new Date(year, 0, 1);
  const to = searchParams.get("to")
    ? new Date(searchParams.get("to")!)
    : new Date(year, 11, 31, 23, 59, 59);

  const docs = await prisma.calculationDocument.findMany({
    where: {
      documentType: "INVOICE",
      issueDate: { gte: from, lte: to },
      calculation: { tenantId: auth.tenantId },
    },
    include: { calculation: { include: { customer: true } } },
    orderBy: [{ issueDate: "asc" }, { documentNumber: "asc" }],
  });

  const rows = docs.map((d) => {
    const snap = d.dataSnapshotJson as unknown as DocumentSnapshot | null;
    const customer = snap?.calc.customer
      ? `${snap.calc.customer.firstName} ${snap.calc.customer.lastName}`
      : d.calculation.customer
        ? `${d.calculation.customer.firstName} ${d.calculation.customer.lastName}`
        : "—";
    const vatPercent = d.netAmount !== 0 ? Math.round((d.vatAmount / d.netAmount) * 100) : 0;
    return {
      number: d.documentNumber,
      date: d.issueDate,
      customer,
      net: d.netAmount,
      vat: d.vatAmount,
      gross: d.grossAmount,
      vatPercent,
      paidAmount: d.paidAmount,
      status: d.status,
    };
  });

  // USt-Auswertung je Steuersatz
  if (format === "ust") {
    const map = new Map<number, { net: number; vat: number; gross: number; count: number }>();
    for (const r of rows) {
      const e = map.get(r.vatPercent) ?? { net: 0, vat: 0, gross: 0, count: 0 };
      e.net += r.net;
      e.vat += r.vat;
      e.gross += r.gross;
      e.count += 1;
      map.set(r.vatPercent, e);
    }
    const lines = [csvRow(["USt-Satz (%)", "Anzahl", "Netto", "USt", "Brutto"])];
    for (const [pct, e] of [...map.entries()].sort((a, b) => b[0] - a[0])) {
      lines.push(csvRow([pct, e.count, deDecimal(e.net), deDecimal(e.vat), deDecimal(e.gross)]));
    }
    return csvResponse(lines.join("\r\n"), `ust-auswertung-${year}.csv`);
  }

  // DATEV-Buchungsstapel (vereinfacht – Erlös-/Debitorenbuchung je Rechnung)
  if (format === "datev") {
    const header = csvRow([
      "Umsatz (Brutto)",
      "Soll/Haben-Kz",
      "Konto",
      "Gegenkonto",
      "Belegdatum",
      "Belegfeld 1",
      "Buchungstext",
      "Steuersatz %",
      "Netto",
      "USt-Betrag",
    ]);
    const lines = [header];
    for (const r of rows) {
      lines.push(
        csvRow([
          deDecimal(Math.abs(r.gross)),
          r.gross < 0 ? "H" : "S",
          "10000", // Debitor-Sammelkonto (anpassbar)
          revenueAccount(r.vatPercent),
          r.date.toLocaleDateString("de-DE"),
          r.number,
          `Rechnung ${r.customer}`.slice(0, 60),
          r.vatPercent,
          deDecimal(r.net),
          deDecimal(r.vat),
        ])
      );
    }
    return csvResponse(lines.join("\r\n"), `datev-buchungsstapel-${year}.csv`);
  }

  // Rechnungsausgangsbuch (Standard)
  const header = csvRow([
    "Belegnummer",
    "Datum",
    "Kunde",
    "Netto",
    "USt-Satz %",
    "USt-Betrag",
    "Brutto",
    "Bezahlt",
    "Status",
  ]);
  const lines = [header];
  for (const r of rows) {
    lines.push(
      csvRow([
        r.number,
        r.date.toLocaleDateString("de-DE"),
        r.customer,
        deDecimal(r.net),
        r.vatPercent,
        deDecimal(r.vat),
        deDecimal(r.gross),
        deDecimal(r.paidAmount),
        r.status,
      ])
    );
  }
  return csvResponse(lines.join("\r\n"), `rechnungsausgangsbuch-${year}.csv`);
}
