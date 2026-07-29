import { formatEuro, formatDate } from "@/lib/utils";
import type { TaxTreatment } from "@/lib/tax/treatment";
import {
  formatBillingAddressLines,
  formatSiteAddressLines,
  hasBillingAddress,
  siteDiffersFromBilling,
} from "@/lib/addresses/billing-vs-site";

export interface DocumentCalcInput {
  title: string | null;
  netSalesPrice: number;
  vatAmount: number;
  grossSalesPrice: number;
  taxTreatment?: TaxTreatment;
  isReverseCharge?: boolean;
  vatNote?: string | null;
  invoiceTaxNotice?: string | null;
  section13bNote?: string | null;
  /** Wenn true: eine Festpreis-Position statt Einzelpositionen (interne Kalkulation bleibt). */
  useFixedPrice?: boolean;
  fixedPriceLabel?: string | null;
  /** Intern kalkulierter Netto (vor Festpreis-Override), für interne Aufschlüsselung. */
  calculatedNetSalesPrice?: number;
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
  /** Zusatzkosten / Projektpositionen (sichtbar auf Kundenrechnung). */
  additionalItems?: {
    description: string;
    totalNet: number;
    isVisibleToCustomer: boolean;
  }[];
  customer: {
    firstName: string;
    lastName: string;
    email?: string | null;
    company?: string | null;
    customerType?: string | null;
    vatId?: string | null;
    contactPerson?: string | null;
    billingStreet?: string | null;
    billingZipCode?: string | null;
    billingCity?: string | null;
  } | null;
  order?: {
    orderNumber: string;
    property?: { street: string; zipCode: string; city: string; label?: string | null } | null;
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

/** Rechnungsadresse: Kunden-Billing, sonst Fallback auf Ausführungsort. */
function customerBillingAddressHtml(calc: DocumentCalcInput): string {
  const lines = formatBillingAddressLines(calc.customer);
  if (lines.length) return lines.join("<br/>");
  const site = formatSiteAddressLines(calc.order?.property);
  return site.join("<br/>");
}

function siteAddressHtml(calc: DocumentCalcInput): string {
  return formatSiteAddressLines(calc.order?.property).join("<br/>");
}

function customerDisplayName(calc: DocumentCalcInput): string {
  const c = calc.customer;
  if (!c) return "Kunde";
  if (c.customerType === "GEWERBLICH" && c.company?.trim()) {
    return c.contactPerson?.trim()
      ? `${c.company.trim()}<br/><span style="font-weight:normal;font-size:13px">z. Hd. ${c.contactPerson.trim()}</span>`
      : c.company.trim();
  }
  return `${c.firstName} ${c.lastName}`;
}

export function calcVisibleLinesSum(calc: DocumentCalcInput): number {
  let sum = 0;
  for (const l of calc.laborItems.filter((x) => x.isVisibleToCustomer)) sum += l.totalNet;
  for (const m of calc.materialItems.filter((x) => x.isVisibleToCustomer)) sum += m.totalSalesNet;
  if (calc.travelCost?.isVisibleToCustomer) sum += calc.travelCost.totalNet;
  for (const a of (calc.additionalItems ?? []).filter((x) => x.isVisibleToCustomer)) {
    sum += a.totalNet;
  }
  return sum;
}

export function calcHiddenAmount(calc: DocumentCalcInput): number {
  if (calc.useFixedPrice) return 0;
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
  const customerName = customerDisplayName(calc);
  const customerNamePlain = calc.customer
    ? calc.customer.customerType === "GEWERBLICH" && calc.customer.company?.trim()
      ? calc.customer.company.trim()
      : `${calc.customer.firstName} ${calc.customer.lastName}`
    : "Kunde";
  const isReverseCharge = calc.isReverseCharge ?? calc.taxTreatment === "REVERSE_CHARGE";

  const visibleLines: string[] = [];
  if (calc.useFixedPrice) {
    const label = (calc.fixedPriceLabel?.trim() || "Festpreis");
    visibleLines.push(
      `<tr><td>${escapeHtml(label)} – ${formatEuro(calc.netSalesPrice)}</td><td style="text-align:right">${formatEuro(calc.netSalesPrice)}</td></tr>`
    );
  } else {
    for (const l of calc.laborItems.filter((x) => x.isVisibleToCustomer)) {
      visibleLines.push(
        `<tr><td>${escapeHtml(l.description)}</td><td style="text-align:right">${formatEuro(l.totalNet)}</td></tr>`
      );
    }
    for (const m of calc.materialItems.filter((x) => x.isVisibleToCustomer)) {
      visibleLines.push(
        `<tr><td>${escapeHtml(m.name)}</td><td style="text-align:right">${formatEuro(m.totalSalesNet)}</td></tr>`
      );
    }
    if (calc.travelCost?.isVisibleToCustomer) {
      visibleLines.push(
        `<tr><td>Anfahrt / Fahrtkosten</td><td style="text-align:right">${formatEuro(calc.travelCost.totalNet)}</td></tr>`
      );
    }
    for (const a of (calc.additionalItems ?? []).filter((x) => x.isVisibleToCustomer)) {
      visibleLines.push(
        `<tr><td>${escapeHtml(a.description)}</td><td style="text-align:right">${formatEuro(a.totalNet)}</td></tr>`
      );
    }

    if (visibleLines.length === 0 && calc.netSalesPrice > 0) {
      visibleLines.push(
        `<tr><td>${escapeHtml(calc.title ?? "Leistungspauschale")}</td><td style="text-align:right">${formatEuro(calc.netSalesPrice)}</td></tr>`
      );
    } else if (hiddenAmount > 0.01) {
      visibleLines.push(
        `<tr><td>Projektpauschale (Gemeinkosten, Wagnis &amp; Gewinn)</td><td style="text-align:right">${formatEuro(hiddenAmount)}</td></tr>`
      );
    }
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
    kundenname: customerNamePlain,
    rechnungsnummer: documentNumber,
    auftragsnummer: calc.order?.orderNumber ?? "",
    adresse: customerBillingAddressHtml(calc).replace(/<br\/?>/g, ", "),
    leistungsort: siteAddressHtml(calc).replace(/<br\/?>/g, ", "),
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

  const taxNoticeBlock =
    isReverseCharge && (calc.invoiceTaxNotice || calc.section13bNote || calc.vatNote)
      ? `<div class="tax-notice" style="margin-top:16px;padding:12px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:8px;font-size:13px">
          ${calc.invoiceTaxNotice ? `<p style="margin:0 0 4px;font-weight:600">${calc.invoiceTaxNotice}</p>` : ""}
          ${calc.section13bNote ? `<p style="margin:0 0 4px">${calc.section13bNote}</p>` : ""}
          ${calc.vatNote ? `<p style="margin:0">${calc.vatNote}</p>` : ""}
        </div>`
      : calc.vatNote
        ? `<p style="font-size:13px;color:#475569;margin-top:12px">${escapeHtml(calc.vatNote)}</p>`
        : "";

  const totalsBlock = isReverseCharge
    ? `<p class="total">Rechnungsbetrag (netto): ${formatEuro(calc.netSalesPrice)}</p>
       <p style="font-size:13px;color:#64748b">Keine Umsatzsteuer ausgewiesen — ${calc.invoiceTaxNotice ?? "Steuerschuldnerschaft des Leistungsempfängers"}</p>`
    : `<p>Umsatzsteuer (${calc.vatAmount > 0 && calc.netSalesPrice > 0 ? Math.round((calc.vatAmount / calc.netSalesPrice) * 100) : 19} %): ${formatEuro(calc.vatAmount)}</p>
       <p class="total">Brutto gesamt: ${formatEuro(calc.grossSalesPrice)}</p>`;

  const customerVatLine = calc.customer?.vatId
    ? `<br/><span style="color:#64748b;font-size:12px">USt-IdNr.: ${calc.customer.vatId}</span>`
    : "";

  const notesBlock = company.invoiceNotes
    ? `<p style="font-size:13px;color:#475569;margin-top:24px">${escapeHtml(applyVariables(company.invoiceNotes, variables)).replace(/\n/g, "<br/>")}</p>`
    : "";

  const footerText = company.invoiceFooterText
    ? escapeHtml(applyVariables(company.invoiceFooterText, variables)).replace(/\n/g, "<br/>")
    : `Der Endpreis enthält alle Kosten für Material, Maschinen, Beschaffung, Anfahrt, Betriebsgemeinkosten,
       Wagnis und Gewinn. Diese Posten werden dem Kunden nicht einzeln ausgewiesen, sind aber in der
       Kalkulation berücksichtigt und fließen in die Netto-Summe ein.`;

  const billingHtml = customerBillingAddressHtml(calc);
  const siteHtml = siteAddressHtml(calc);
  const siteDiffers = siteDiffersFromBilling(calc.customer, calc.order?.property);
  const showLeistungsort = Boolean(siteHtml) && (siteDiffers || (type === "OFFER" && hasBillingAddress(calc.customer)));

  const recipientBlock =
    type === "OFFER"
      ? `<div style="text-align:right">
        <strong>Kunde</strong>
        ${customerName}<br/>
        ${billingHtml || siteHtml}${customerVatLine}
        ${showLeistungsort ? `<br/><br/><strong>Leistungsort / Baustelle</strong><br/>${siteHtml}` : ""}
        ${calc.order ? `<br/><span style="color:#64748b">Auftrag ${calc.order.orderNumber}</span>` : ""}
      </div>`
      : `<div style="text-align:right">
        <strong>Rechnungsempfänger</strong>
        ${customerName}<br/>
        ${billingHtml}${customerVatLine}
        ${
          siteHtml && siteDiffers
            ? `<br/><br/><strong>Leistungsort</strong><br/>${siteHtml}`
            : ""
        }
        ${calc.order ? `<br/><span style="color:#64748b">Auftrag ${calc.order.orderNumber}</span>` : ""}
      </div>`;

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
      ${recipientBlock}
    </div>

    ${introBlock}

    <p style="font-size:15px;font-weight:600;margin-bottom:8px">${calc.title ?? "Leistung"}</p>

    <table>
      <thead><tr><th>Position</th><th style="text-align:right">Netto</th></tr></thead>
      <tbody>${visibleLines.join("")}</tbody>
    </table>

    <div class="totals">
      ${
        calc.useFixedPrice
          ? `<p>Abrechnung als Festpreis (${escapeHtml(calc.fixedPriceLabel?.trim() || "Festpreis")})</p>`
          : `<p>Zwischensumme sichtbare Positionen: ${formatEuro(visibleSum)}</p>
      ${hiddenAmount > 0.01 ? `<p>Pauschale / interne Kostenanteile: ${formatEuro(hiddenAmount)}</p>` : ""}`
      }
      <p class="total">Netto gesamt: ${formatEuro(calc.netSalesPrice)}</p>
      ${totalsBlock}
    </div>

    ${taxNoticeBlock}
    ${paymentBlock}
    ${notesBlock}

    <p class="footer">${footerText}</p>
  </body></html>`;
}

/** Interne Aufschlüsselung – nur für Büro/Chef, nicht an Kunden senden */
export function buildInternalBreakdownHtml(calc: DocumentCalcInput, documentNumber: string) {
  const visibleSum = calc.useFixedPrice ? 0 : calcVisibleLinesSum(calc);
  const hiddenAmount = calcHiddenAmount(calc);
  const calculatedNet = calc.calculatedNetSalesPrice ?? calc.netSalesPrice;
  const difference = calc.netSalesPrice - calculatedNet;

  const rows: [string, number][] = [
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
    ["= Netto kalkuliert (intern)", calculatedNet],
  ];

  if (calc.useFixedPrice) {
    rows.push(
      [`Festpreis an Kunde (${calc.fixedPriceLabel?.trim() || "Festpreis"})`, calc.netSalesPrice],
      ["Differenz Festpreis − Kalkulation", difference]
    );
  }

  rows.push(
    ["+ USt (Kundenbetrag)", calc.vatAmount],
    ["= Brutto (Kundenbetrag)", calc.grossSalesPrice]
  );

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
      ${rows.map(([label, val]) => {
        const isTotal = String(label).startsWith("=");
        return `<tr class="${isTotal ? "bold" : ""}"><td>${label}</td><td>${formatEuro(val)}</td></tr>`;
      }).join("")}
    </table>
    <div class="note">
      ${
        calc.useFixedPrice
          ? `<strong>Kundenausgabe:</strong> Festpreis „${escapeHtml(calc.fixedPriceLabel?.trim() || "Festpreis")}“ – ${formatEuro(calc.netSalesPrice)}<br/>
      <strong>Interne Kalkulation:</strong> ${formatEuro(calculatedNet)} (bleibt gespeichert)<br/>
      <strong>Differenz:</strong> ${formatEuro(difference)}`
          : `<strong>Sichtbar für Kunden:</strong> ${formatEuro(visibleSum)} in Einzelpositionen<br/>
      <strong>Versteckt (Pauschale):</strong> ${formatEuro(hiddenAmount)}<br/>
      <strong>Erklärung:</strong> Maschinen, Beschaffung, Gemeinkosten, Wagnis und Gewinn erhöhen den Nettopreis
      über die sichtbaren Positionen hinaus. Der Kunde sieht eine Pauschale oder nur die freigegebenen Zeilen –
      intern addieren sich alle Kostenblöcke zum Netto-Verkaufspreis.`
      }
    </div>
  </body></html>`;
}
