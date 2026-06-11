import type { DocumentSnapshot } from "./snapshot";
import { getVisibleLineItems } from "./line-items";

function xml(s: string | number | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function num(n: number): string {
  return (Math.round(n * 100) / 100).toFixed(2);
}

export interface EInvoiceValidation {
  valid: boolean;
  errors: string[];
}

/**
 * Prüft die EN16931-Pflichtfelder, bevor eine E-Rechnung erzeugt wird.
 * (Leichte Validierung – ersetzt keine vollständige Schematron-Prüfung.)
 */
export function validateForEInvoice(snapshot: DocumentSnapshot): EInvoiceValidation {
  const errors: string[] = [];
  const c = snapshot.company;
  if (!c.companyName) errors.push("Firmenname (Verkäufer) fehlt");
  if (!c.postalCode || !c.city) errors.push("Anschrift des Verkäufers unvollständig");
  if (!c.vatId && !c.taxNumber) errors.push("USt-IdNr. oder Steuernummer des Verkäufers fehlt");
  if (!snapshot.calc.customer) errors.push("Käuferdaten fehlen");
  if (snapshot.type !== "INVOICE") errors.push("E-Rechnung ist nur für Rechnungen vorgesehen");
  return { valid: errors.length === 0, errors };
}

/**
 * Erzeugt eine EN16931-konforme UBL-Rechnung (XRechnung-Profil) aus dem Snapshot.
 * Negative Beträge (Stornorechnung) werden als Gutschrift (TypeCode 381) abgebildet.
 */
export function buildEInvoiceXml(snapshot: DocumentSnapshot): string {
  const { calc, company } = snapshot;
  const isCredit = snapshot.amounts.gross < 0;
  const typeCode = isCredit ? "381" : "380";

  const net = calc.netSalesPrice;
  const vat = calc.vatAmount;
  const gross = calc.grossSalesPrice;
  const vatPercent = net !== 0 ? Math.round((vat / net) * 10000) / 100 : 19;

  const issueDate = new Date(snapshot.issueDateISO).toISOString().slice(0, 10);
  const dueDate =
    company.paymentTermsDays != null
      ? new Date(
          new Date(snapshot.issueDateISO).getTime() +
            company.paymentTermsDays * 24 * 60 * 60 * 1000
        )
          .toISOString()
          .slice(0, 10)
      : issueDate;

  const customerName = calc.customer
    ? `${calc.customer.firstName} ${calc.customer.lastName}`
    : "Kunde";
  const prop = calc.order?.property;

  const lines = getVisibleLineItems(calc);
  const lineXml = lines
    .map(
      (l, i) => `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${num(l.amount)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xml(l.label)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${num(vatPercent)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${num(l.amount)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`
    )
    .join("\n");

  const payeeFinancial = company.iban
    ? `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${xml(company.iban)}</cbc:ID>
      ${company.bankName ? `<cbc:Name>${xml(company.bankName)}</cbc:Name>` : ""}
      ${company.bic ? `<cac:FinancialInstitutionBranch><cbc:ID>${xml(company.bic)}</cbc:ID></cac:FinancialInstitutionBranch>` : ""}
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${xml(snapshot.documentNumber)}</cbc:ID>
  <cbc:IssueDate>${issueDate}</cbc:IssueDate>
  <cbc:DueDate>${dueDate}</cbc:DueDate>
  <cbc:InvoiceTypeCode>${typeCode}</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${xml([company.street, company.houseNumber].filter(Boolean).join(" "))}</cbc:StreetName>
        <cbc:CityName>${xml(company.city)}</cbc:CityName>
        <cbc:PostalZone>${xml(company.postalCode)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${company.vatId ? `<cac:PartyTaxScheme><cbc:CompanyID>${xml(company.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>` : ""}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xml(company.companyName)}</cbc:RegistrationName>
        ${company.taxNumber ? `<cbc:CompanyID>${xml(company.taxNumber)}</cbc:CompanyID>` : ""}
      </cac:PartyLegalEntity>
      ${company.email ? `<cac:Contact><cbc:ElectronicMail>${xml(company.email)}</cbc:ElectronicMail></cac:Contact>` : ""}
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        ${prop ? `<cbc:StreetName>${xml(prop.street)}</cbc:StreetName>` : ""}
        ${prop ? `<cbc:CityName>${xml(prop.city)}</cbc:CityName>` : ""}
        ${prop ? `<cbc:PostalZone>${xml(prop.zipCode)}</cbc:PostalZone>` : ""}
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xml(customerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
      ${calc.customer?.email ? `<cac:Contact><cbc:ElectronicMail>${xml(calc.customer.email)}</cbc:ElectronicMail></cac:Contact>` : ""}
    </cac:Party>
  </cac:AccountingCustomerParty>
${payeeFinancial}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${num(vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${num(net)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${num(vat)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>${num(vatPercent)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${num(net)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${num(net)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${num(gross)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${num(gross)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lineXml}
</Invoice>`;
}
