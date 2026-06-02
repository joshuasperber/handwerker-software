import { prisma } from "@/lib/prisma";
import type { DocumentCalcInput, DocumentCompanyInput } from "./build-document-html";

export async function loadCalculationForDocument(tenantId: string, calculationId: string) {
  const calc = await prisma.calculation.findFirst({
    where: { id: calculationId, tenantId },
    include: {
      laborItems: true,
      materialItems: true,
      travelCost: true,
      customer: true,
      order: { include: { property: true } },
    },
  });
  if (!calc) return null;

  const [companySettings, tenant] = await Promise.all([
    prisma.companySettings.findUnique({ where: { tenantId } }),
    prisma.tenant.findUnique({ where: { id: tenantId } }),
  ]);

  const docCalc: DocumentCalcInput = {
    title: calc.title,
    netSalesPrice: calc.netSalesPrice,
    vatAmount: calc.vatAmount,
    grossSalesPrice: calc.grossSalesPrice,
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
  };

  return { calc: docCalc, company, orderId: calc.orderId, raw: calc };
}
