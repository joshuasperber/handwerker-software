import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { resolveFixedPriceLabel } from "@/lib/calculation/fixed-price";
import { suggestTaxTreatmentForCustomer } from "@/lib/tax/treatment";
import { roundMoney } from "@/lib/calculation/formulas";

export async function GET(_request: NextRequest) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const calculations = await prisma.calculation.findMany({
    where: {
      tenantId: auth.tenantId,
      OR: [
        { directCosts: { gt: 0 } },
        { totalBillableHours: { gt: 0 } },
        { laborItems: { some: {} } },
        { materialItems: { some: {} } },
        { machineUsages: { some: {} } },
        { useFixedPrice: true },
        { status: { not: "DRAFT" } },
      ],
    },
    include: {
      customer: {
        select: {
          firstName: true,
          lastName: true,
          company: true,
          customerType: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return apiSuccess(calculations);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const { title, customerId, orderId } = body;
  const useFixedPrice = Boolean(body.useFixedPrice);
  const amountMode = body.amountMode === "gross" ? "gross" : "net";

  const company = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  const overhead = await prisma.overheadSettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  const defaultVatRate = company?.defaultVatRate ?? 19;

  let customer = null;
  if (customerId) {
    customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: auth.tenantId },
      select: {
        id: true,
        customerType: true,
        company: true,
        vatId: true,
      },
    });
    if (!customer) return apiError("Kunde nicht gefunden", 404);
  }

  const taxSuggestion = suggestTaxTreatmentForCustomer(customer);
  const taxTreatment = taxSuggestion?.taxTreatment ?? "STANDARD_VAT";
  const reverseCharge = Boolean(taxSuggestion?.reverseCharge);

  let fixedPriceNet: number | null = null;
  let fixedPriceLabel: string | null = null;
  let resolvedTitle = typeof title === "string" && title.trim() ? title.trim() : "Neue Kalkulation";

  if (useFixedPrice) {
    const rawAmount = Number(body.fixedPriceNet ?? body.fixedPriceAmount);
    if (!Number.isFinite(rawAmount) || rawAmount < 0) {
      return apiError("Bitte einen gültigen Festpreis in € angeben (0,00 € ist erlaubt).", 400);
    }
    // Bei Reverse-Charge ist Brutto = Netto; sonst Brutto → Netto umrechnen.
    fixedPriceNet =
      amountMode === "gross" && !reverseCharge && defaultVatRate > 0
        ? roundMoney(rawAmount / (1 + defaultVatRate / 100))
        : roundMoney(rawAmount);
    fixedPriceLabel = resolveFixedPriceLabel(
      typeof body.fixedPriceLabel === "string" ? body.fixedPriceLabel : null
    );
    if (!title?.trim()) {
      resolvedTitle = `${fixedPriceLabel} ${fixedPriceNet.toLocaleString("de-DE", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} €`;
    }
  }

  const calc = await prisma.calculation.create({
    data: {
      tenantId: auth.tenantId,
      title: resolvedTitle,
      customerId: customer?.id ?? undefined,
      orderId: orderId ?? undefined,
      useFixedPrice,
      fixedPriceNet,
      fixedPriceLabel,
      riskSettings: {
        create: {
          riskLevel: "NORMAL",
          riskPercent: company?.defaultRiskPercent ?? 7,
        },
      },
      profitSettings: {
        create: {
          profitPercent: company?.defaultProfitPercent ?? 12,
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
          vatRatePercent: defaultVatRate,
          taxTreatment,
          reverseCharge,
          reverseChargeConfirmed: false,
          includeSection13bNote: true,
        },
      },
    },
    include: {
      riskSettings: true,
      profitSettings: true,
      incomeTaxSettings: true,
      vatSettings: true,
      customer: true,
    },
  });

  // Festpreis: zu Angebot/Rechnung; bei Reverse-Charge-Vorschlag zuerst Steuer bestätigen.
  const openStep = !useFixedPrice
    ? 0
    : reverseCharge
      ? 9
      : 10;

  return apiSuccess(
    {
      ...calc,
      taxSuggestionReason: taxSuggestion?.reason ?? null,
      openStep,
    },
    201
  );
}
