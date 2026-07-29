import { prisma } from "@/lib/prisma";
import type { DocumentCalcInput, DocumentCompanyInput } from "./build-document-html";
import { calcVatWithTreatment, resolveTaxTreatment } from "@/lib/tax/treatment";

export async function loadCalculationForDocument(tenantId: string, calculationId: string) {
  const calc = await prisma.calculation.findFirst({
    where: { id: calculationId, tenantId },
    include: {
      laborItems: true,
      materialItems: true,
      travelCost: true,
      additionalItems: true,
      vatSettings: true,
      customer: true,
      order: { include: { property: true } },
    },
  });
  if (!calc) return null;

  const [companySettings, tenant] = await Promise.all([
    prisma.companySettings.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);

  const taxTreatment = resolveTaxTreatment(
    calc.vatSettings?.taxTreatment ?? null,
    calc.vatSettings?.reverseCharge
  );

  const useFixedPrice =
    Boolean(calc.useFixedPrice) &&
    calc.fixedPriceNet != null &&
    Number.isFinite(calc.fixedPriceNet);
  const customerNet = useFixedPrice ? Number(calc.fixedPriceNet) : calc.netSalesPrice;

  const vatResult = calcVatWithTreatment(
    {
      netSalesPrice: customerNet,
      vatRatePercent: calc.vatSettings?.vatRatePercent ?? 19,
      taxTreatment,
      reverseCharge: calc.vatSettings?.reverseCharge,
      taxExempt: calc.vatSettings?.taxExempt,
    },
    { includeSection13bNote: calc.vatSettings?.includeSection13bNote !== false }
  );

  const docCalc: DocumentCalcInput = {
    title: calc.title,
    netSalesPrice: customerNet,
    vatAmount: vatResult.vatAmount,
    grossSalesPrice: vatResult.grossSalesPrice,
    taxTreatment: vatResult.taxTreatment,
    isReverseCharge: vatResult.isReverseCharge,
    vatNote: calc.vatSettings?.vatNote,
    invoiceTaxNotice: vatResult.invoiceNotice,
    section13bNote: vatResult.section13bNote,
    useFixedPrice,
    fixedPriceLabel: calc.fixedPriceLabel,
    calculatedNetSalesPrice: calc.netSalesPrice,
    laborTotal: calc.laborTotal,
    materialTotal: calc.materialTotal,
    machineTotal: calc.machineTotal,
    procurementTotal: calc.procurementTotal,
    travelTotal: calc.travelTotal,
    additionalTotal: calc.additionalTotal,
    directCosts: calc.directCosts,
    overheadAmount: calc.overheadAmount,
    riskAmount: calc.riskAmount,
    profitAmount: calc.profitAmount,
    laborItems: calc.laborItems,
    materialItems: calc.materialItems,
    travelCost: calc.travelCost,
    additionalItems: calc.additionalItems.map((a) => ({
      description: a.description,
      totalNet: a.totalNet,
      isVisibleToCustomer: a.isVisibleToCustomer,
    })),
    customer: calc.customer,
    order: calc.order
      ? {
          orderNumber: calc.order.orderNumber,
          property: calc.order.property,
        }
      : null,
  };

  const company: DocumentCompanyInput = {
    companyName: companySettings?.companyName ?? tenant?.name ?? "Handwerksbetrieb",
    street: companySettings?.street,
    houseNumber: companySettings?.houseNumber,
    postalCode: companySettings?.postalCode,
    city: companySettings?.city,
    logoUrl: tenant?.logoUrl,
    phone: companySettings?.phone ?? tenant?.phone,
    email: companySettings?.email ?? tenant?.email,
    website: companySettings?.website,
    invoiceLogoUrl: companySettings?.invoiceLogoUrl,
    bankName: companySettings?.bankName,
    iban: companySettings?.iban,
    bic: companySettings?.bic,
    taxNumber: companySettings?.taxNumber,
    vatId: companySettings?.vatId,
    paymentTermsDays: companySettings?.paymentTermsDays,
    invoiceIntroText: companySettings?.invoiceIntroText,
    invoiceFooterText: companySettings?.invoiceFooterText,
    invoiceNotes: companySettings?.invoiceNotes,
  };

  return { calc: docCalc, company, orderId: calc.orderId, raw: calc };
}
