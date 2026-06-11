import { formatEuro, formatDate } from "@/lib/utils";

export interface DocumentCalcInput {
  title: string | null;
  netSalesPrice: number;
  vatAmount: number;
  grossSalesPrice: number;
  laborTotal: number;
  materialTotal: number;
  machineTotal: number;
  procurementTotal: number;
  travelTotal: number;
  additionalTotal: number;
  directCosts: number;
  overheadAmount: number;
  riskAmount: number;
  profitAmount: number;
  laborItems: { description: string; totalNet: number; isVisibleToCustomer: boolean }[];
  materialItems: { name: string; totalSalesNet: number; isVisibleToCustomer: boolean }[];
  travelCost: { totalNet: number; isVisibleToCustomer: boolean } | null;
  customer: {
    firstName: string;
    lastName: string;
    email?: string | null;
  } | null;
  order?: {
    orderNumber: string;
    property?: { street: string; zipCode: string; city: string } | null;
  } | null;
}

export interface DocumentCompanyInput {
  companyName: string;
  street?: string | null;
  houseNumber?: string | null;
  postalCode?: string | null;
  city?: string | null;
  logoUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  // Rechnungs-Personalisierung
  invoiceLogoUrl?: string | null;
  bankName?: string | null;
  iban?: string | null;
  bic?: string | null;
  taxNumber?: string | null;
  vatId?: string | null;
  paymentTermsDays?: number | null;
  invoiceIntroText?: string | null;
  invoiceFooterText?: string | null;
  invoiceNotes?: string | null;
}

/** Ersetzt Platzhalter wie {{kundenname}} im personalisierten Text. */
function applyVariables(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => vars[key.toLowerCase()] ?? "");
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function companyAddress(c: DocumentCompanyInput): string {
  const line1 = [c.street, c.houseNumber].filter(Boolean).join(" ");
  const line2 = [c.postalCode, c.city].filter(Boolean).join(" ");
  return [line1, line2].filter(Boolean).join("<br/>");
}

function customerAddress(calc: DocumentCalcInput): string {
  const p = calc.order?.property;
  if (!p) return "";
  return `${p.street}<br/>${p.zipCode} ${p.city}`;
}

export function calcVisibleLinesSum(calc: DocumentCalcInput): number {
  let sum = 0;
  for (const l of calc.laborItems.filter((x) => x.isVisibleToCustomer)) sum += l.totalNet;
  for (const m of calc.materialItems.filter((x) => x.isVisibleToCustomer)) sum += m.totalSalesNet;
  if (calc.travelCost?.isVisibleToCustomer) sum += calc.travelCost.totalNet;
  return sum;
}

export function calcHiddenAmount(calc: DocumentCalcInput): number {
  return Math.max(0, calc.netSalesPrice - calcVisibleLinesSum(calc));
}

export function buildCustomerDocumentHtml(
  type: "OFFER" | "INVOICE",
  calc: DocumentCalcInput,
  company: DocumentCompanyInput,
  documentNumber: string,
  issueDate: Date = new Date()
) {
  const title = type === "INVOICE" ? "Rechnung" : "Angebot";
  const visibleSum = calcVisibleLinesSum(calc);
  const hiddenAmount = calcHiddenAmount(calc);
  const customerName = calc.customer
    ? `${calc.customer.firstName} ${calc.customer.lastName}`
    : "Kunde";

  const visibleLines: string[] = [];
  for (const l of calc.laborItems.filter((x) => x.isVisibleToCustomer)) {
    visibleLines.push(
      `<tr><td>${l.description}</td><td style="text-align:right">${formatEuro(l.totalNet)}</td></tr>`
    );
  }
  for (const m of calc.materialItems.filter((x) => x.isVisibleToCustomer)) {
    visibleLines.push(
      `<tr><td>${m.name}</td><td style="text-align:right">${formatEuro(m.totalSalesNet)}</td></tr>`
    );
  }
  if (calc.travelCost?.isVisibleToCustomer) {
    visibleLines.push(
      `<tr><td>Anfahrt / Fahrtkosten</td><td style="text-align:right">${formatEuro(calc.travelCost.totalNet)}</td></tr>`
    );
  }

  if (visibleLines.length === 0 && calc.netSalesPrice > 0) {
    visibleLines.push(
      `<tr><td>${calc.title ?? "Leistungspauschale"}</td><td style="text-align:right">${formatEuro(calc.netSalesPrice)}</td></tr>`
    );
  } else if (hiddenAmount > 0.01) {
    visibleLines.push(
      `<tr><td>Projektpauschale (Material, Maschinen, Beschaffung, Gemeinkosten, Wagnis &amp; Gewinn)</td><td style="text-align:right">${formatEuro(hiddenAmount)}</td></tr>`
    );
  }

  const logoUrl = company.invoiceLogoUrl || company.logoUrl;
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" style="max-height:56px;max-width:180px;margin-bottom:12px"/>`
    : "";

  const dueDate =
    type === "INVOICE" && company.paymentTermsDays != null
      ? new Date(issueDate.getTime() + company.paymentTermsDays * 24 * 60 * 60 * 1000)
      : null;

  const variables: Record<string, string> = {
    firmenname: company.companyName,
    kundenname: customerName,
    rechnungsnummer: documentNumber,
    auftragsnummer: calc.order?.orderNumber ?? "",
    adresse: customerAddress(calc).replace(/<br\/?>/g, ", "),
    gesamtsumme: formatEuro(calc.grossSalesPrice),
    nettosumme: formatEuro(calc.netSalesPrice),
    zahlungsziel: dueDate ? formatDate(dueDate) : "",
    datum: formatDate(issueDate),
  };

  const introBlock = company.invoiceIntroText
    ? `<p style="font-size:14px;margin:16px 0">${escapeHtml(applyVariables(company.invoiceIntroText, variables)).replace(/\n/g, "<br/>")}</p>`
    : "";

  const paymentBlock =
    type === "INVOICE"
      ? `<div class="payment">
          ${dueDate ? `<p><strong>Zahlungsziel:</strong> ${formatDate(dueDate)}${company.paymentTermsDays ? ` (${company.paymentTermsDays} Tage)` : ""}</p>` : ""}
          ${company.bankName || company.iban ? `<p><strong>Bankverbindung:</strong> ${[company.bankName, company.iban ? `IBAN ${company.iban}` : "", company.bic ? `BIC ${company.bic}` : ""].filter(Boolean).join(" · ")}</p>` : ""}
        </div>`
      : "";

  const taxLine = [
    company.taxNumber ? `Steuernr.: ${company.taxNumber}` : "",
    company.vatId ? `USt-IdNr.: ${company.vatId}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const contactLine = [
    company.phone ? `Tel.: ${company.phone}` : "",
    company.email ?? "",
    company.website ?? "",
  ]
    .filter(Boolean)
    .join(" · ");

  const notesBlock = company.invoiceNotes
    ? `<p style="font-size:13px;color:#475569;margin-top:24px">${escapeHtml(applyVariables(company.invoiceNotes, variables)).replace(/\n/g, "<br/>")}</p>`
    : "";

  const footerText = company.invoiceFooterText
    ? escapeHtml(applyVariables(company.invoiceFooterText, variables)).replace(/\n/g, "<br/>")
    : `Der Endpreis enthält alle Kosten für Material, Maschinen, Beschaffung, Anfahrt, Betriebsgemeinkosten,
       Wagnis und Gewinn. Diese Posten werden dem Kunden nicht einzeln ausgewiesen, sind aber in der
       Kalkulation berücksichtigt und fließen in die Netto-Summe ein.`;

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><style>
    body{font-family:Inter,system-ui,sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:0 auto;line-height:1.5}
    h1{color:#0d5c63;margin:0 0 4px;font-size:1.75rem}
    .meta{color:#64748b;font-size:14px;margin-bottom:24px}
    .addresses{display:flex;justify-content:space-between;gap:32px;margin-bottom:32px;font-size:14px}
    .addresses strong{display:block;color:#0d5c63;margin-bottom:4px}
    table{width:100%;border-collapse:collapse;margin:24px 0}
    th{text-align:left;padding:10px 8px;border-bottom:2px solid #0d5c63;color:#0d5c63;font-size:13px}
    td{padding:10px 8px;border-bottom:1px solid #e2e8f0;font-size:14px}
    .totals{margin-top:16px;text-align:right;font-size:14px}
    .total{font-weight:bold;font-size:1.15em;color:#0d5c63}
    .payment{margin-top:24px;font-size:13px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px}
    .payment p{margin:2px 0}
    .footer{font-size:12px;color:#64748b;margin-top:48px;border-top:1px solid #e2e8f0;padding-top:16px}
    @media print{body{padding:16px}.no-print{display:none}}
    .print-bar{position:sticky;top:0;display:flex;justify-content:flex-end;gap:8px;padding:8px 0;margin-bottom:8px}
    .print-bar button{background:#0d5c63;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer}
  </style></head><body>
    <div class="print-bar no-print">
      <button onclick="window.print()" type="button">Als PDF speichern / drucken</button>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px">
      <div>${logoBlock}<h1>${title}</h1><p class="meta">${documentNumber} · ${formatDate(issueDate)}</p></div>
    </div>

    <div class="addresses">
      <div>
        <strong>Auftragnehmer</strong>
        ${company.companyName}<br/>
        ${companyAddress(company)}
        ${contactLine ? `<br/><span style="color:#64748b;font-size:12px">${contactLine}</span>` : ""}
        ${taxLine ? `<br/><span style="color:#64748b;font-size:12px">${taxLine}</span>` : ""}
      </div>
      <div style="text-align:right">
        <strong>Rechnungsempfänger</strong>
        ${customerName}<br/>
        ${customerAddress(calc)}
        ${calc.order ? `<br/><span style="color:#64748b">Auftrag ${calc.order.orderNumber}</span>` : ""}
      </div>
    </div>

    ${introBlock}

    <p style="font-size:15px;font-weight:600;margin-bottom:8px">${calc.title ?? "Leistung"}</p>

    <table>
      <thead><tr><th>Position</th><th style="text-align:right">Netto</th></tr></thead>
      <tbody>${visibleLines.join("")}</tbody>
    </table>

    <div class="totals">
      <p>Zwischensumme sichtbare Positionen: ${formatEuro(visibleSum)}</p>
      ${hiddenAmount > 0.01 ? `<p>Pauschale / interne Kostenanteile: ${formatEuro(hiddenAmount)}</p>` : ""}
      <p class="total">Netto gesamt: ${formatEuro(calc.netSalesPrice)}</p>
      <p>Umsatzsteuer: ${formatEuro(calc.vatAmount)}</p>
      <p class="total">Brutto gesamt: ${formatEuro(calc.grossSalesPrice)}</p>
    </div>

    ${paymentBlock}
    ${notesBlock}

    <p class="footer">${footerText}</p>
  </body></html>`;
}

/** Interne Aufschlüsselung – nur für Büro/Chef, nicht an Kunden senden */
export function buildInternalBreakdownHtml(calc: DocumentCalcInput, documentNumber: string) {
  const visibleSum = calcVisibleLinesSum(calc);
  const hiddenAmount = calcHiddenAmount(calc);

  const rows = [
    ["Arbeit (intern)", calc.laborTotal],
    ["Material (intern)", calc.materialTotal],
    ["Maschinen (intern, ggf. versteckt)", calc.machineTotal],
    ["Beschaffung (intern, ggf. versteckt)", calc.procurementTotal],
    ["Fahrt (intern)", calc.travelTotal],
    ["Zusatzkosten", calc.additionalTotal],
    ["= Direkte Kosten", calc.directCosts],
    ["+ Gemeinkosten", calc.overheadAmount],
    ["+ Wagnis", calc.riskAmount],
    ["+ Gewinn", calc.profitAmount],
    ["= Netto-Verkaufspreis", calc.netSalesPrice],
    ["+ USt", calc.vatAmount],
    ["= Brutto", calc.grossSalesPrice],
  ];

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><style>
    body{font-family:system-ui,sans-serif;padding:32px;color:#1e293b}
    h1{color:#0d5c63;font-size:1.25rem}
    table{width:100%;border-collapse:collapse;margin:16px 0;font-size:14px}
    td{padding:6px 8px;border-bottom:1px solid #e2e8f0}
    td:last-child{text-align:right;font-variant-numeric:tabular-nums}
    .bold{font-weight:700;background:#f8fafc}
    .note{background:#fffbeb;border:1px solid #fde68a;padding:12px;border-radius:8px;font-size:13px;margin-top:20px}
  </style></head><body>
    <h1>Interne Preisaufbau – ${documentNumber}</h1>
    <p style="color:#64748b;font-size:13px">So entsteht die Kundensumme aus der vollständigen Kalkulation</p>
    <table>
      ${rows.map(([label, val], i) => {
        const isTotal = String(label).startsWith("=");
        return `<tr class="${isTotal ? "bold" : ""}"><td>${label}</td><td>${formatEuro(val as number)}</td></tr>`;
      }).join("")}
    </table>
    <div class="note">
      <strong>Sichtbar für Kunden:</strong> ${formatEuro(visibleSum)} in Einzelpositionen<br/>
      <strong>Versteckt (Pauschale):</strong> ${formatEuro(hiddenAmount)}<br/>
      <strong>Erklärung:</strong> Maschinen, Beschaffung, Gemeinkosten, Wagnis und Gewinn erhöhen den Nettopreis
      über die sichtbaren Positionen hinaus. Der Kunde sieht eine Pauschale oder nur die freigegebenen Zeilen –
      intern addieren sich alle Kostenblöcke zum Netto-Verkaufspreis.
    </div>
  </body></html>`;
}
