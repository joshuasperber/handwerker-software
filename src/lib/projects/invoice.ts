import { prisma } from "@/lib/prisma";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";

/**
 * Erstellt eine Projekt-Kalkulation aus ausgewählten Kosten-/Auftragspositionen.
 * Der Nutzer wählt danach in der Kalkulation und kann dort die Rechnung erzeugen.
 */
export async function createProjectInvoiceCalculation(input: {
  tenantId: string;
  projectId: string;
  title?: string;
  costIds?: string[];
  orderIds?: string[];
}) {
  const project = await prisma.project.findFirst({
    where: { id: input.projectId, tenantId: input.tenantId },
    include: {
      costs: true,
      orders: {
        include: {
          services: { include: { service: true } },
        },
      },
    },
  });
  if (!project) throw new Error("Projekt nicht gefunden");

  const selectedCosts = project.costs.filter(
    (c) =>
      (input.costIds?.length ? input.costIds.includes(c.id) : c.isBillable) &&
      c.isBillable
  );

  const selectedOrders = project.orders.filter((o) =>
    input.orderIds?.length ? input.orderIds.includes(o.id) : false
  );

  if (selectedCosts.length === 0 && selectedOrders.length === 0) {
    throw new Error("Bitte mindestens eine Position für die Rechnung auswählen.");
  }

  const company = await prisma.companySettings.findUnique({
    where: { tenantId: input.tenantId },
  });
  const overhead = await prisma.overheadSettings.findUnique({
    where: { tenantId: input.tenantId },
  });

  const additionalCreates: {
    category: "OTHER";
    description: string;
    amountNet: number;
    markupPercent: number;
    totalNet: number;
    isVisibleToCustomer: boolean;
  }[] = [];

  for (const cost of selectedCosts) {
    additionalCreates.push({
      category: "OTHER",
      description: cost.description,
      amountNet: cost.netAmount,
      markupPercent: 0,
      totalNet: cost.netAmount,
      isVisibleToCustomer: true,
    });
  }

  for (const order of selectedOrders) {
    for (const os of order.services) {
      const label =
        os.service?.name ?? os.customName ?? `Leistung ${order.orderNumber}`;
      const qty = os.quantity && os.quantity > 0 ? os.quantity : 1;
      if (os.unitPriceCents != null) {
        const amountNet = (os.unitPriceCents / 100) * qty;
        additionalCreates.push({
          category: "OTHER",
          description: `${order.orderNumber}: ${label}`,
          amountNet,
          markupPercent: 0,
          totalNet: amountNet,
          isVisibleToCustomer: true,
        });
      } else {
        const hours = os.service
          ? Math.max((os.service.durationMinutes / 60) * qty, 0.25)
          : qty;
        const rate = company?.defaultHourlyRate ?? 68;
        const amountNet = hours * rate;
        additionalCreates.push({
          category: "OTHER",
          description: `${order.orderNumber}: ${label}`,
          amountNet,
          markupPercent: 0,
          totalNet: amountNet,
          isVisibleToCustomer: true,
        });
      }
    }
    if (order.services.length === 0) {
      additionalCreates.push({
        category: "OTHER",
        description: `${order.orderNumber}${order.title ? `: ${order.title}` : ""}`,
        amountNet: 0,
        markupPercent: 0,
        totalNet: 0,
        isVisibleToCustomer: true,
      });
    }
  }

  const calc = await prisma.calculation.create({
    data: {
      tenantId: input.tenantId,
      title: input.title?.trim() || `Abschlussrechnung ${project.name}`,
      customerId: project.customerId,
      projectId: project.id,
      additionalItems: { create: additionalCreates },
      riskSettings: {
        create: {
          riskLevel: "NORMAL",
          riskPercent: company?.defaultRiskPercent ?? 0,
        },
      },
      profitSettings: {
        create: {
          profitPercent: company?.defaultProfitPercent ?? 0,
          profitStrategy: "PERCENT",
        },
      },
      incomeTaxSettings: {
        create: {
          estimatedIncomeTaxPercent: company?.defaultIncomeTaxPercent ?? 30,
          productiveHoursPerMonth: overhead?.productiveHoursPerMonth ?? 160,
          allocationMode: "PROFIT_CHECK_ONLY",
        },
      },
      vatSettings: {
        create: {
          vatRatePercent: company?.defaultVatRate ?? 19,
        },
      },
    },
  });

  await recalculateCalculationRecord(calc.id, input.tenantId);

  return prisma.calculation.findFirstOrThrow({
    where: { id: calc.id },
    select: {
      id: true,
      title: true,
      status: true,
      netSalesPrice: true,
      vatAmount: true,
      grossSalesPrice: true,
    },
  });
}
