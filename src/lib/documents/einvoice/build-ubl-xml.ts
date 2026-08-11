import type { DocumentSnapshot } from "../snapshot";
import { getVisibleLineItems } from "../line-items";
import { buyerDisplayName, resolveBuyerAddress } from "./validate";

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

function taxCategory(snapshot: DocumentSnapshot): { id: string; percent: number; exemptionReason?: string } {
  const isRc =
    Boolean(snapshot.calc.isReverseCharge) || snapshot.calc.taxTreatment === "REVERSE_CHARGE";
  if (isRc) {
    return {
      id: "AE",
      percent: 0,
      exemptionReason: "Steuerschuldnerschaft des Leistungsempfängers (Reverse Charge)",
    };
  }
  if (snapshot.calc.taxTreatment === "BUILDING_EXEMPTION") {
    return {
      id: "E",
      percent: 0,
      exemptionReason: snapshot.calc.vatNote?.trim() || "Steuerbefreit / Bauleistung",
    };
  }
  const net = snapshot.amounts.net;
  const vat = snapshot.amounts.vat;
  const percent = net !== 0 ? Math.round((vat / net) * 10000) / 100 : 19;
  return { id: "S", percent };
}

/**
 * Erzeugt UBL Invoice 2.1 im XRechnung-3.0-Customization-Profil (EN 16931).
 * Voraussetzung: validateForEInvoice().valid === true.
 */
export function buildXRechnungUblXml(snapshot: DocumentSnapshot): string {
  const { calc, company } = snapshot;
  const isCredit = snapshot.amounts.gross < 0;
  const typeCode = isCredit ? "381" : "380";
  const tax = taxCategory(snapshot);

  const net = snapshot.amounts.net;
  const vat = snapshot.amounts.vat;
  const gross = snapshot.amounts.gross;

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

  const buyerName = buyerDisplayName(snapshot);
  const buyerAddr = resolveBuyerAddress(snapshot);
  const sellerStreet = [company.street, company.houseNumber].filter(Boolean).join(" ");

  const lines = getVisibleLineItems(calc);
  const lineXml = lines
    .map((l, i) => {
      const amount = Number(l.amount) || 0;
      return `  <cac:InvoiceLine>
    <cbc:ID>${i + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${num(amount)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${xml(l.label)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${tax.id}</cbc:ID>
        <cbc:Percent>${num(tax.percent)}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${num(amount)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`;
    })
    .join("\n");

  const buyerVat = calc.customer?.vatId?.trim()
    ? `      <cac:PartyTaxScheme>
        <cbc:CompanyID>${xml(calc.customer.vatId)}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>`
    : "";

  const contactPerson = calc.customer?.contactPerson?.trim();
  const buyerContact =
    calc.customer?.email || contactPerson
      ? `      <cac:Contact>
        ${contactPerson ? `<cbc:Name>${xml(contactPerson)}</cbc:Name>` : ""}
        ${calc.customer?.email ? `<cbc:ElectronicMail>${xml(calc.customer.email)}</cbc:ElectronicMail>` : ""}
      </cac:Contact>`
      : "";

  const sellerContact =
    company.email || company.phone
      ? `      <cac:Contact>
        ${company.phone ? `<cbc:Telephone>${xml(company.phone)}</cbc:Telephone>` : ""}
        ${company.email ? `<cbc:ElectronicMail>${xml(company.email)}</cbc:ElectronicMail>` : ""}
      </cac:Contact>`
      : "";

  const taxExemption =
    tax.exemptionReason
      ? `<cbc:TaxExemptionReason>${xml(tax.exemptionReason)}</cbc:TaxExemptionReason>`
      : "";

  const paymentTerms =
    company.paymentTermsDays != null
      ? `  <cac:PaymentTerms>
    <cbc:Note>Zahlbar innerhalb von ${company.paymentTermsDays} Tagen ohne Abzug.</cbc:Note>
  </cac:PaymentTerms>`
      : "";

  const payeeFinancial = company.iban
    ? `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>58</cbc:PaymentMeansCode>
    <cbc:PaymentID>${xml(snapshot.documentNumber)}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>${xml(company.iban.replace(/\s+/g, ""))}</cbc:ID>
      ${company.bankName ? `<cbc:Name>${xml(company.bankName)}</cbc:Name>` : ""}
      ${
        company.bic
          ? `<cac:FinancialInstitutionBranch><cbc:ID>${xml(company.bic)}</cbc:ID></cac:FinancialInstitutionBranch>`
          : ""
      }
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : "";

  const noteParts = [
    calc.invoiceTaxNotice,
    calc.section13bNote,
    calc.vatNote,
    "Leistungsdatum entspricht dem Rechnungsdatum, sofern nicht anders vereinbart.",
  ].filter((x) => typeof x === "string" && x.trim());

  const notesXml = noteParts
    .map((n) => `  <cbc:Note>${xml(n)}</cbc:Note>`)
    .join("\n");

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
${notesXml}
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>${xml(calc.order?.orderNumber || snapshot.documentNumber)}</cbc:BuyerReference>
  <cac:InvoicePeriod>
    <cbc:StartDate>${issueDate}</cbc:StartDate>
    <cbc:EndDate>${issueDate}</cbc:EndDate>
  </cac:InvoicePeriod>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${xml(sellerStreet)}</cbc:StreetName>
        <cbc:CityName>${xml(company.city)}</cbc:CityName>
        <cbc:PostalZone>${xml(company.postalCode)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      ${
        company.vatId
          ? `<cac:PartyTaxScheme><cbc:CompanyID>${xml(company.vatId)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>`
          : ""
      }
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xml(company.companyName)}</cbc:RegistrationName>
        ${company.taxNumber ? `<cbc:CompanyID>${xml(company.taxNumber)}</cbc:CompanyID>` : ""}
      </cac:PartyLegalEntity>
${sellerContact}
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PostalAddress>
        <cbc:StreetName>${xml(buyerAddr.street)}</cbc:StreetName>
        <cbc:CityName>${xml(buyerAddr.city)}</cbc:CityName>
        <cbc:PostalZone>${xml(buyerAddr.zip)}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
${buyerVat}
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xml(buyerName)}</cbc:RegistrationName>
      </cac:PartyLegalEntity>
${buyerContact}
    </cac:Party>
  </cac:AccountingCustomerParty>
${payeeFinancial}
${paymentTerms}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${num(vat)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">${num(net)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">${num(vat)}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>${tax.id}</cbc:ID>
        <cbc:Percent>${num(tax.percent)}</cbc:Percent>
        ${taxExemption}
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
</Invoice>
`;
}
