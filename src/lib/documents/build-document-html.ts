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

  const positionRows: { label: string; amount: number }[] = [];
  if (calc.useFixedPrice) {
    positionRows.push({
      label: escapeHtml(calc.fixedPriceLabel?.trim() || "Festpreis"),
      amount: calc.netSalesPrice,
    });
  } else {
    for (const l of calc.laborItems.filter((x) => x.isVisibleToCustomer)) {
      positionRows.push({ label: escapeHtml(l.description), amount: l.totalNet });
    }
    for (const m of calc.materialItems.filter((x) => x.isVisibleToCustomer)) {
      positionRows.push({ label: escapeHtml(m.name), amount: m.totalSalesNet });
    }
    if (calc.travelCost?.isVisibleToCustomer) {
      positionRows.push({ label: "Anfahrt / Fahrtkosten", amount: calc.travelCost.totalNet });
    }
    for (const a of (calc.additionalItems ?? []).filter((x) => x.isVisibleToCustomer)) {
      positionRows.push({ label: escapeHtml(a.description), amount: a.totalNet });
    }

    if (positionRows.length === 0 && calc.netSalesPrice > 0) {
      positionRows.push({
        label: escapeHtml(calc.title ?? "Leistungspauschale"),
        amount: calc.netSalesPrice,
      });
    } else if (hiddenAmount > 0.01) {
      positionRows.push({
        label: "Projektpauschale (Gemeinkosten, Wagnis &amp; Gewinn)",
        amount: hiddenAmount,
      });
    }
  }

  const visibleLines = positionRows.map(
    (row, i) =>
      `<tr>
        <td class="pos-nr">${i + 1}</td>
        <td>${row.label}</td>
        <td class="amount">${formatEuro(row.amount)}</td>
      </tr>`
  );

  const logoUrl = company.invoiceLogoUrl || company.logoUrl;
  const logoBlock = logoUrl
    ? `<img src="${logoUrl}" alt="Logo" class="logo"/>`
    : `<div class="logo-fallback">${escapeHtml(company.companyName)}</div>`;

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
    ? `<p class="intro">${escapeHtml(applyVariables(company.invoiceIntroText, variables)).replace(/\n/g, "<br/>")}</p>`
    : "";

  const paymentBlock =
    type === "INVOICE" && (dueDate || company.bankName || company.iban)
      ? `<div class="payment">
          <p class="payment-title">Zahlungsinformationen</p>
          ${dueDate ? `<div class="payment-row"><span>Zahlbar bis</span><strong>${formatDate(dueDate)}${company.paymentTermsDays ? ` (${company.paymentTermsDays} Tage)` : ""}</strong></div>` : ""}
          ${company.bankName ? `<div class="payment-row"><span>Bank</span><strong>${escapeHtml(company.bankName)}</strong></div>` : ""}
          ${company.iban ? `<div class="payment-row"><span>IBAN</span><strong>${escapeHtml(company.iban)}</strong></div>` : ""}
          ${company.bic ? `<div class="payment-row"><span>BIC</span><strong>${escapeHtml(company.bic)}</strong></div>` : ""}
          <div class="payment-row"><span>Verwendungszweck</span><strong>${documentNumber}</strong></div>
        </div>`
      : "";

  const taxLine = [
    company.taxNumber ? `Steuernr. ${company.taxNumber}` : "",
    company.vatId ? `USt-IdNr. ${company.vatId}` : "",
  ]
    .filter(Boolean)
    .join("<br/>");

  const contactFooter = [
    company.phone ? `Tel. ${escapeHtml(company.phone)}` : "",
    company.email ? escapeHtml(company.email) : "",
    company.website ? escapeHtml(company.website) : "",
  ]
    .filter(Boolean)
    .join("<br/>");

  const bankFooter = [
    company.bankName ? escapeHtml(company.bankName) : "",
    company.iban ? `IBAN ${escapeHtml(company.iban)}` : "",
    company.bic ? `BIC ${escapeHtml(company.bic)}` : "",
  ]
    .filter(Boolean)
    .join("<br/>");

  const taxNoticeBlock =
    isReverseCharge && (calc.invoiceTaxNotice || calc.section13bNote || calc.vatNote)
      ? `<div class="tax-notice">
          ${calc.invoiceTaxNotice ? `<p style="margin:0 0 4px;font-weight:600">${calc.invoiceTaxNotice}</p>` : ""}
          ${calc.section13bNote ? `<p style="margin:0 0 4px">${calc.section13bNote}</p>` : ""}
          ${calc.vatNote ? `<p style="margin:0">${calc.vatNote}</p>` : ""}
        </div>`
      : calc.vatNote
        ? `<p class="vat-note">${escapeHtml(calc.vatNote)}</p>`
        : "";

  const vatRatePercent =
    calc.vatAmount > 0 && calc.netSalesPrice > 0
      ? Math.round((calc.vatAmount / calc.netSalesPrice) * 100)
      : 19;

  const totalsRows = isReverseCharge
    ? `<div class="totals-row"><span>Netto gesamt</span><span>${formatEuro(calc.netSalesPrice)}</span></div>
       <div class="totals-grand"><span>Rechnungsbetrag (netto)</span><span>${formatEuro(calc.netSalesPrice)}</span></div>
       <p class="totals-hint">Keine Umsatzsteuer ausgewiesen — ${calc.invoiceTaxNotice ?? "Steuerschuldnerschaft des Leistungsempfängers"}</p>`
    : `<div class="totals-row"><span>Netto gesamt</span><span>${formatEuro(calc.netSalesPrice)}</span></div>
       <div class="totals-row"><span>Umsatzsteuer ${vatRatePercent} %</span><span>${formatEuro(calc.vatAmount)}</span></div>
       <div class="totals-grand"><span>Gesamtbetrag</span><span>${formatEuro(calc.grossSalesPrice)}</span></div>`;

  const totalsSubline = calc.useFixedPrice
    ? `<div class="totals-row muted"><span>Abrechnung als Festpreis (${escapeHtml(calc.fixedPriceLabel?.trim() || "Festpreis")})</span><span></span></div>`
    : hiddenAmount > 0.01
      ? `<div class="totals-row muted"><span>Sichtbare Positionen</span><span>${formatEuro(visibleSum)}</span></div>
         <div class="totals-row muted"><span>Pauschale / Kostenanteile</span><span>${formatEuro(hiddenAmount)}</span></div>`
      : "";

  const customerVatLine = calc.customer?.vatId
    ? `<br/><span class="small muted-text">USt-IdNr. ${calc.customer.vatId}</span>`
    : "";

  const notesBlock = company.invoiceNotes
    ? `<p class="notes">${escapeHtml(applyVariables(company.invoiceNotes, variables)).replace(/\n/g, "<br/>")}</p>`
    : "";

  const footerText = company.invoiceFooterText
    ? escapeHtml(applyVariables(company.invoiceFooterText, variables)).replace(/\n/g, "<br/>")
    : `Der Endpreis enthält alle Kosten für Material, Maschinen, Beschaffung, Anfahrt, Betriebsgemeinkosten,
       Wagnis und Gewinn. Diese Posten werden dem Kunden nicht einzeln ausgewiesen, sind aber in der
       Kalkulation berücksichtigt und fließen in die Netto-Summe ein.`;

  const billingHtml = customerBillingAddressHtml(calc);
  const siteHtml = siteAddressHtml(calc);
  const siteDiffers = siteDiffersFromBilling(calc.customer, calc.order?.property);
  const showLeistungsort =
    Boolean(siteHtml) && (siteDiffers || (type === "OFFER" && hasBillingAddress(calc.customer)));

  const senderLine = [
    company.companyName,
    [company.street, company.houseNumber].filter(Boolean).join(" "),
    [company.postalCode, company.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .map((s) => escapeHtml(String(s)))
    .join(" · ");

  const recipientAddress = type === "OFFER" ? billingHtml || siteHtml : billingHtml;

  const metaRows = [
    [`${title}s-Nr.`, documentNumber],
    ["Datum", formatDate(issueDate)],
    calc.order ? ["Auftrag", calc.order.orderNumber] : null,
    type === "INVOICE" && dueDate ? ["Zahlbar bis", formatDate(dueDate)] : null,
  ].filter((r): r is [string, string] => Boolean(r));

  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"/><style>
    *{box-sizing:border-box}
    body{font-family:Inter,system-ui,-apple-system,sans-serif;color:#0f172a;margin:0;background:#f1f5f9;line-height:1.55;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .sheet{max-width:800px;margin:24px auto;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(15,23,42,.1);overflow:hidden}
    .accent-bar{height:6px;background:linear-gradient(90deg,#0d5c63,#14929c)}
    .inner{padding:44px 48px}
    .logo{max-height:56px;max-width:200px;object-fit:contain}
    .logo-fallback{font-size:20px;font-weight:700;color:#0d5c63}
    .head{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;margin-bottom:36px}
    .doc-type{margin:0;font-size:28px;font-weight:800;letter-spacing:-.02em;color:#0d5c63;text-align:right}
    .doc-number{margin:2px 0 0;font-size:13px;color:#64748b;text-align:right}
    .address-block{display:flex;justify-content:space-between;gap:32px;margin-bottom:36px}
    .sender-line{font-size:10px;color:#94a3b8;border-bottom:1px solid #e2e8f0;padding-bottom:3px;margin-bottom:10px}
    .recipient{font-size:14px}
    .recipient .name{font-weight:600}
    .meta-card{min-width:240px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:13px;align-self:flex-start}
    .meta-card .row{display:flex;justify-content:space-between;gap:16px;padding:3px 0}
    .meta-card .row span:first-child{color:#64748b}
    .meta-card .row span:last-child{font-weight:600;text-align:right}
    .subject{font-size:16px;font-weight:700;margin:0 0 4px}
    .intro{font-size:14px;color:#334155;margin:12px 0 0}
    table{width:100%;border-collapse:collapse;margin:24px 0 8px}
    th{text-align:left;padding:10px 10px;background:#0d5c63;color:#fff;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
    th:first-child{border-radius:8px 0 0 8px;width:44px}
    th:last-child{border-radius:0 8px 8px 0;text-align:right}
    td{padding:11px 10px;border-bottom:1px solid #eef2f7;font-size:14px;vertical-align:top}
    tr:nth-child(even) td{background:#fafcfd}
    .pos-nr{color:#94a3b8;font-size:13px}
    .amount{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    .totals{margin-left:auto;max-width:340px;font-size:14px}
    .totals-row{display:flex;justify-content:space-between;gap:24px;padding:5px 10px}
    .totals-row.muted{color:#64748b;font-size:13px}
    .totals-row span:last-child{font-variant-numeric:tabular-nums}
    .totals-grand{display:flex;justify-content:space-between;gap:24px;margin-top:6px;padding:12px 14px;background:#0d5c63;color:#fff;border-radius:10px;font-weight:700;font-size:16px}
    .totals-grand span:last-child{font-variant-numeric:tabular-nums}
    .totals-hint{font-size:12px;color:#64748b;padding:6px 10px 0;margin:0}
    .tax-notice{margin-top:20px;padding:14px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:10px;font-size:13px}
    .vat-note{font-size:13px;color:#475569;margin-top:14px}
    .payment{margin-top:28px;padding:16px 18px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;font-size:13px;max-width:380px}
    .payment-title{margin:0 0 8px;font-weight:700;color:#0d5c63;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
    .payment-row{display:flex;justify-content:space-between;gap:16px;padding:2px 0}
    .payment-row span{color:#64748b}
    .notes{font-size:13px;color:#475569;margin-top:24px}
    .small{font-size:12px}
    .muted-text{color:#64748b}
    .footer{margin-top:44px;border-top:2px solid #0d5c63;padding-top:16px}
    .footer-note{font-size:11px;color:#94a3b8;margin:0 0 14px}
    .footer-cols{display:flex;justify-content:space-between;gap:24px;font-size:11px;color:#64748b}
    .footer-cols strong{display:block;color:#334155;margin-bottom:2px;font-size:11px}
    @media print{
      body{background:#fff}
      .sheet{margin:0;max-width:none;border-radius:0;box-shadow:none}
      .inner{padding:24px 28px}
      .no-print{display:none}
    }
    .print-bar{position:sticky;top:0;z-index:10;display:flex;justify-content:flex-end;gap:8px;padding:10px 16px;background:rgba(241,245,249,.92);backdrop-filter:blur(4px)}
    .print-bar button{background:#0d5c63;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-size:14px;font-weight:600;cursor:pointer}
    .print-bar button:hover{background:#0a4a50}
  </style></head><body>
    <div class="print-bar no-print">
      <button onclick="window.print()" type="button">Als PDF speichern / drucken</button>
    </div>

    <div class="sheet">
      <div class="accent-bar"></div>
      <div class="inner">

        <div class="head">
          <div>${logoBlock}</div>
          <div>
            <h1 class="doc-type">${title}</h1>
            <p class="doc-number">${documentNumber}</p>
          </div>
        </div>

        <div class="address-block">
          <div class="recipient">
            ${senderLine ? `<div class="sender-line">${senderLine}</div>` : ""}
            <div class="name">${customerName}</div>
            ${recipientAddress ? `${recipientAddress}` : ""}${customerVatLine}
            ${showLeistungsort ? `<div style="margin-top:12px"><span class="small muted-text" style="font-weight:600">Leistungsort / Baustelle</span><br/>${siteHtml}</div>` : ""}
          </div>
          <div class="meta-card">
            ${metaRows.map(([k, v]) => `<div class="row"><span>${k}</span><span>${v}</span></div>`).join("")}
          </div>
        </div>

        <p class="subject">${escapeHtml(calc.title ?? "Leistung")}</p>
        ${introBlock}

        <table>
          <thead><tr><th>Pos.</th><th>Bezeichnung</th><th>Betrag (netto)</th></tr></thead>
          <tbody>${visibleLines.join("")}</tbody>
        </table>

        <div class="totals">
          ${totalsSubline}
          ${totalsRows}
        </div>

        ${taxNoticeBlock}
        ${paymentBlock}
        ${notesBlock}

        <div class="footer">
          <p class="footer-note">${footerText}</p>
          <div class="footer-cols">
            <div>
              <strong>${escapeHtml(company.companyName)}</strong>
              ${companyAddress(company)}
            </div>
            ${contactFooter ? `<div><strong>Kontakt</strong>${contactFooter}</div>` : ""}
            ${bankFooter ? `<div><strong>Bankverbindung</strong>${bankFooter}</div>` : ""}
            ${taxLine ? `<div><strong>Steuer</strong>${taxLine}</div>` : ""}
          </div>
        </div>

      </div>
    </div>
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
