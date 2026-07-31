import { roundMoney } from "@/lib/calculation/formulas";

export type TaxTreatment =
  | "STANDARD_VAT"
  | "REVERSE_CHARGE"
  | "BUILDING_EXEMPTION"
  | "MANUAL_REVIEW";

export const TAX_TREATMENT_LABELS: Record<TaxTreatment, string> = {
  STANDARD_VAT: "Standardrechnung mit Umsatzsteuer",
  REVERSE_CHARGE: "Reverse-Charge / Steuerschuldnerschaft des Leistungsempfängers",
  BUILDING_EXEMPTION: "Bauabzugsteuer / Freistellungsbescheinigung dokumentieren",
  MANUAL_REVIEW: "Sonderfall / manuelle Prüfung erforderlich",
};

export const TAX_TREATMENT_SHORT: Record<TaxTreatment, string> = {
  STANDARD_VAT: "Standard (brutto)",
  REVERSE_CHARGE: "Reverse-Charge (netto)",
  BUILDING_EXEMPTION: "Freistellung (Bauabzug)",
  MANUAL_REVIEW: "Manuelle Prüfung",
};

export const REVERSE_CHARGE_NOTICE =
  "Steuerschuldnerschaft des Leistungsempfängers";

export const REVERSE_CHARGE_SECTION_13B =
  "Gemäß § 13b UStG schuldet der Leistungsempfänger die Umsatzsteuer.";

export const REVERSE_CHARGE_WARNING =
  "Diese Option darf nur verwendet werden, wenn die Voraussetzungen für die Steuerschuldnerschaft des Leistungsempfängers erfüllt sind. Bitte im Zweifel steuerlich prüfen lassen.";

export const BUILDING_EXEMPTION_INFO =
  "Die Freistellungsbescheinigung betrifft die Bauabzugsteuer und ersetzt nicht automatisch die Umsatzsteuerprüfung.";

export interface VatCalcInput {
  netSalesPrice: number;
  vatRatePercent: number;
  taxTreatment: TaxTreatment;
  reverseCharge?: boolean;
  taxExempt?: boolean;
}

export interface VatCalcResult {
  vatAmount: number;
  grossSalesPrice: number;
  taxTreatment: TaxTreatment;
  isReverseCharge: boolean;
  invoiceNotice: string | null;
  section13bNote: string | null;
}

export function resolveTaxTreatment(
  taxTreatment?: TaxTreatment | null,
  reverseCharge?: boolean
): TaxTreatment {
  if (taxTreatment) return taxTreatment;
  if (reverseCharge) return "REVERSE_CHARGE";
  return "STANDARD_VAT";
}

export function calcVatWithTreatment(
  input: VatCalcInput,
  options?: { includeSection13bNote?: boolean }
): VatCalcResult {
  const treatment = resolveTaxTreatment(input.taxTreatment, input.reverseCharge);
  const net = roundMoney(input.netSalesPrice);

  if (treatment === "REVERSE_CHARGE" || input.reverseCharge) {
    const include13b = options?.includeSection13bNote !== false;
    return {
      vatAmount: 0,
      grossSalesPrice: net,
      taxTreatment: "REVERSE_CHARGE",
      isReverseCharge: true,
      invoiceNotice: REVERSE_CHARGE_NOTICE,
      section13bNote: include13b ? REVERSE_CHARGE_SECTION_13B : null,
    };
  }

  if (input.taxExempt) {
    return {
      vatAmount: 0,
      grossSalesPrice: net,
      taxTreatment: treatment,
      isReverseCharge: false,
      invoiceNotice: null,
      section13bNote: null,
    };
  }

  const vatAmount = roundMoney(net * (input.vatRatePercent / 100));
  return {
    vatAmount,
    grossSalesPrice: roundMoney(net + vatAmount),
    taxTreatment: treatment,
    isReverseCharge: false,
    invoiceNotice: null,
    section13bNote: null,
  };
}

export interface CommercialCustomerCheck {
  customerType?: string | null;
  company?: string | null;
  vatId?: string | null;
}

export function reverseChargeWarnings(customer: CommercialCustomerCheck | null | undefined): string[] {
  const warnings: string[] = [];
  if (!customer) {
    warnings.push("Kein Kunde zugeordnet — bitte Kundendaten prüfen.");
    return warnings;
  }
  if (customer.customerType !== "GEWERBLICH") {
    warnings.push("Der Kunde ist nicht als Business-/Gewerbekunde markiert. Reverse-Charge ist in der Regel nur für gewerbliche Leistungsempfänger relevant.");
  }
  if (!customer.company?.trim()) {
    warnings.push("Firmenname fehlt im Kundenstamm.");
  }
  if (!customer.vatId?.trim()) {
    warnings.push("USt-IdNr. des Kunden fehlt — für Reverse-Charge oft erforderlich.");
  }
  return warnings;
}

/**
 * Vorschlag für die steuerliche Behandlung anhand des Kundenstamms.
 * Keine automatische Entscheidung — Reverse-Charge bleibt unbestätigt.
 */
export function suggestTaxTreatmentForCustomer(
  customer: CommercialCustomerCheck | null | undefined
): {
  taxTreatment: TaxTreatment;
  reverseCharge: boolean;
  reason: string;
} | null {
  if (!customer) return null;
  if (customer.customerType === "GEWERBLICH" && customer.vatId?.trim()) {
    return {
      taxTreatment: "REVERSE_CHARGE",
      reverseCharge: true,
      reason:
        "Business-Kunde mit USt-IdNr.: Reverse-Charge (§ 13b) vorgeschlagen. Bitte in „Steuer & Ergebnis“ bewusst bestätigen — der Steuersatz auf der Rechnung wird dann 0 % (netto).",
    };
  }
  if (customer.customerType === "GEWERBLICH") {
    return {
      taxTreatment: "STANDARD_VAT",
      reverseCharge: false,
      reason:
        "Business-Kunde ohne USt-IdNr.: Standard-Umsatzsteuer bleibt aktiv. Bei Bauleistungen/§ 13b ggf. manuell auf Reverse-Charge umstellen und USt-IdNr. nachtragen.",
    };
  }
  return {
    taxTreatment: "STANDARD_VAT",
    reverseCharge: false,
    reason: "Privatkunde: Standardrechnung mit Umsatzsteuer.",
  };
}
