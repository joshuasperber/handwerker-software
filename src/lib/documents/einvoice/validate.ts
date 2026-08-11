import type { DocumentSnapshot } from "../snapshot";
import { getVisibleLineItems } from "../line-items";
import {
  formatBillingAddressOneLine,
  formatSiteAddressOneLine,
  hasBillingAddress,
} from "@/lib/addresses/billing-vs-site";
import type { EInvoiceIssue, EInvoiceReadiness } from "./types";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buyerDisplayName(snapshot: DocumentSnapshot): string {
  const c = snapshot.calc.customer;
  if (!c) return "—";
  if (c.company?.trim()) return c.company.trim();
  return `${c.firstName} ${c.lastName}`.trim() || "—";
}

export function resolveBuyerAddress(snapshot: DocumentSnapshot): {
  street: string;
  zip: string;
  city: string;
  source: "billing" | "site" | "missing";
} {
  const customer = snapshot.calc.customer;
  if (hasBillingAddress(customer)) {
    return {
      street: customer!.billingStreet!.trim(),
      zip: customer!.billingZipCode!.trim(),
      city: customer!.billingCity!.trim(),
      source: "billing",
    };
  }
  const prop = snapshot.calc.order?.property;
  if (prop?.street?.trim() && prop.zipCode?.trim() && prop.city?.trim()) {
    return {
      street: prop.street.trim(),
      zip: prop.zipCode.trim(),
      city: prop.city.trim(),
      source: "site",
    };
  }
  return { street: "", zip: "", city: "", source: "missing" };
}

/**
 * Prüft EN16931-/XRechnung-Pflichtfelder vor der Erzeugung.
 * Keine Schematron-Validierung – blockiert aber unvollständige Daten.
 */
export function validateForEInvoice(snapshot: DocumentSnapshot): EInvoiceReadiness {
  const issues: EInvoiceIssue[] = [];
  const push = (code: string, message: string, severity: "error" | "warning" = "error") => {
    issues.push({ code, message, severity });
  };

  if (snapshot.type !== "INVOICE") {
    push("NOT_INVOICE", "E-Rechnung ist nur für Rechnungen vorgesehen.");
  }

  const company = snapshot.company;
  if (!company.companyName?.trim()) {
    push("SELLER_NAME", "Firmenname fehlt.");
  }
  if (!company.street?.trim() || !company.postalCode?.trim() || !company.city?.trim()) {
    push("SELLER_ADDRESS", "Anschrift des Verkäufers unvollständig.");
  }
  if (!company.vatId?.trim() && !company.taxNumber?.trim()) {
    push("SELLER_TAX", "USt-ID oder Steuernummer des Verkäufers fehlt.");
  }
  if (!company.iban?.trim()) {
    push("SELLER_IBAN", "Bankverbindung (IBAN) fehlt.");
  }
  if (!company.email?.trim()) {
    push("SELLER_EMAIL", "E-Mail des Verkäufers fehlt.", "warning");
  }
  if (!company.bic?.trim()) {
    push("SELLER_BIC", "BIC fehlt (empfohlen für SEPA).", "warning");
  }

  const customer = snapshot.calc.customer;
  if (!customer) {
    push("BUYER_MISSING", "Käuferdaten fehlen.");
  } else {
    if (!buyerDisplayName(snapshot) || buyerDisplayName(snapshot) === "—") {
      push("BUYER_NAME", "Kundenname / Firmenname fehlt.");
    }
    const addr = resolveBuyerAddress(snapshot);
    if (addr.source === "missing") {
      push("BUYER_ADDRESS", "Rechnungsadresse unvollständig.");
    } else if (addr.source === "site") {
      push(
        "BUYER_ADDRESS_SITE",
        "Keine Rechnungsadresse hinterlegt – Ausführungsadresse wird verwendet.",
        "warning"
      );
    }
    const isBusiness =
      customer.customerType === "BUSINESS" ||
      Boolean(customer.company?.trim()) ||
      Boolean(customer.vatId?.trim());
    if (isBusiness && !customer.vatId?.trim()) {
      push("BUYER_VAT", "USt-ID fehlt.", "warning");
    }
    if (!customer.email?.trim()) {
      push("BUYER_EMAIL", "Kunden-E-Mail fehlt (für späteren manuellen Versand).", "warning");
    }
  }

  if (!snapshot.documentNumber?.trim()) {
    push("DOC_NUMBER", "Rechnungsnummer fehlt.");
  }
  if (!snapshot.issueDateISO) {
    push("ISSUE_DATE", "Rechnungsdatum fehlt.");
  }

  const lines = getVisibleLineItems(snapshot.calc);
  if (!lines.length) {
    push("NO_LINES", "Keine Rechnungspositionen vorhanden.");
  }
  lines.forEach((line, i) => {
    if (!line.label?.trim()) {
      push("LINE_LABEL", `Bezeichnung fehlt bei Position ${i + 1}.`);
    }
    if (!Number.isFinite(line.amount)) {
      push("LINE_AMOUNT", `Betrag fehlt oder ungültig bei Position ${i + 1}.`);
    }
  });

  const net = round2(snapshot.amounts.net);
  const vat = round2(snapshot.amounts.vat);
  const gross = round2(snapshot.amounts.gross);
  const lineSum = round2(lines.reduce((s, l) => s + (Number(l.amount) || 0), 0));
  if (lines.length && Math.abs(lineSum - net) > 0.05) {
    push(
      "LINE_SUM_MISMATCH",
      `Positionssumme (${lineSum.toFixed(2)} €) weicht vom Netto (${net.toFixed(2)} €) ab.`
    );
  }
  if (Math.abs(round2(net + vat) - gross) > 0.05) {
    push("TOTAL_MISMATCH", "Netto + Steuer entspricht nicht dem Bruttobetrag.");
  }

  const isRc = Boolean(snapshot.calc.isReverseCharge || snapshot.calc.taxTreatment === "REVERSE_CHARGE");
  if (!isRc && Math.abs(vat) < 0.005 && Math.abs(net) > 0.005) {
    push("VAT_ZERO", "Steuersatz/Steuerbetrag fehlt oder ist 0 – bitte Steuerbehandlung prüfen.", "warning");
  }
  if (isRc && Math.abs(vat) > 0.005) {
    push("RC_VAT", "Bei Reverse Charge darf kein Steuerbetrag ausgewiesen sein.");
  }

  push(
    "SERVICE_DATE",
    "Leistungsdatum/-zeitraum ist nicht separat gespeichert – Rechnungsdatum wird als Leistungsdatum verwendet.",
    "warning"
  );
  push(
    "NO_SCHEMATRON",
    "Hinweis: Es erfolgt eine App-Validierung der Pflichtdaten, keine externe Schematron-/KoSIT-Prüfung.",
    "warning"
  );

  const errors = issues.filter((i) => i.severity === "error").map((i) => i.message);
  const warnings = issues.filter((i) => i.severity === "warning").map((i) => i.message);
  const addr = resolveBuyerAddress(snapshot);
  const buyerAddress =
    addr.source === "billing"
      ? formatBillingAddressOneLine(customer)
      : addr.source === "site"
        ? formatSiteAddressOneLine(snapshot.calc.order?.property)
        : "—";

  const dueDate =
    snapshot.company.paymentTermsDays != null
      ? new Date(
          new Date(snapshot.issueDateISO).getTime() +
            snapshot.company.paymentTermsDays * 24 * 60 * 60 * 1000
        ).toISOString()
      : null;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues,
    preview: {
      documentNumber: snapshot.documentNumber,
      issueDate: snapshot.issueDateISO,
      dueDate,
      buyerName: buyerDisplayName(snapshot),
      buyerAddress: buyerAddress || "—",
      sellerName: company.companyName || "—",
      net,
      vat,
      gross,
      lineCount: lines.length,
      taxTreatment: isRc
        ? "Reverse Charge"
        : snapshot.calc.taxTreatment === "BUILDING_EXEMPTION"
          ? "Steuerbefreit / Bau"
          : "Regelbesteuerung",
      serviceDateNote: "Rechnungsdatum (kein separates Leistungsdatum gespeichert)",
    },
  };
}
