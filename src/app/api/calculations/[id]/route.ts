import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";
import { suggestTaxTreatmentForCustomer } from "@/lib/tax/treatment";

const includeFull = {
  laborItems: true,
  materialItems: true,
  machineUsages: { include: { machine: true } },
  procurementCosts: true,
  travelCost: true,
  additionalItems: true,
  riskSettings: true,
  profitSettings: true,
  incomeTaxSettings: true,
  vatSettings: true,
  customer: true,
  documents: true,
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const calc = await prisma.calculation.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: includeFull,
  });

  if (!calc) return apiError("Kalkulation nicht gefunden", 404);
  return apiSuccess(calc);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.calculation.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Kalkulation nicht gefunden", 404);

  if (body.title != null || body.currentStep != null || body.customerId !== undefined) {
    await prisma.calculation.update({
      where: { id },
      data: {
        ...(body.title != null ? { title: body.title } : {}),
        ...(body.currentStep != null ? { currentStep: body.currentStep } : {}),
        ...(body.customerId !== undefined
          ? { customerId: body.customerId ? String(body.customerId) : null }
          : {}),
      },
    });
  }

  // Bei Kundenwechsel: Steuerbehandlung vorschlagen (ohne automatische Bestätigung).
  if (body.customerId !== undefined && body.vat == null) {
    const customer = body.customerId
      ? await prisma.customer.findFirst({
          where: { id: String(body.customerId), tenantId: auth.tenantId },
          select: { customerType: true, company: true, vatId: true },
        })
      : null;
    const suggestion = suggestTaxTreatmentForCustomer(customer);
    if (suggestion) {
      const existingVat = await prisma.vATSettings.findUnique({
        where: { calculationId: id },
        select: { vatRatePercent: true },
      });
      const company = await prisma.companySettings.findUnique({
        where: { tenantId: auth.tenantId },
        select: { defaultVatRate: true },
      });
      const vatRatePercent =
        existingVat?.vatRatePercent ?? company?.defaultVatRate ?? 19;
      await prisma.vATSettings.upsert({
        where: { calculationId: id },
        create: {
          calculationId: id,
          vatRatePercent,
          taxTreatment: suggestion.taxTreatment,
          reverseCharge: suggestion.reverseCharge,
          reverseChargeConfirmed: false,
          includeSection13bNote: true,
        },
        update: {
          taxTreatment: suggestion.taxTreatment,
          reverseCharge: suggestion.reverseCharge,
          reverseChargeConfirmed: false,
        },
      });
    }
  }

  if (body.laborItems) {
    await prisma.laborItem.deleteMany({ where: { calculationId: id } });
    await prisma.laborItem.createMany({
      data: body.laborItems.map((l: Record<string, unknown>) => ({
        calculationId: id,
        description: String(l.description ?? "Arbeit"),
        laborType: l.laborType ?? "ONSITE_WORK",
        hours: Number(l.hours),
        hourlyRateNet: Number(l.hourlyRateNet),
        quantityWorkers: Number(l.quantityWorkers ?? 1),
        isVisibleToCustomer: l.isVisibleToCustomer !== false,
      })),
    });
  }

  if (body.materialItems) {
    await prisma.materialItem.deleteMany({ where: { calculationId: id } });
    await prisma.materialItem.createMany({
      data: body.materialItems.map((m: Record<string, unknown>) => ({
        calculationId: id,
        articleId: m.articleId ? String(m.articleId) : null,
        name: String(m.name),
        description: m.description != null ? String(m.description) : null,
        quantity: Number(m.quantity),
        unit: String(m.unit ?? "Stück"),
        purchasePriceNet: Number(m.purchasePriceNet),
        markupPercent: Number(m.markupPercent ?? 25),
        wastePercent: Number(m.wastePercent ?? 0),
        supplierName: m.supplierName != null ? String(m.supplierName) : null,
        articleNumber: m.articleNumber != null ? String(m.articleNumber) : null,
        isVisibleToCustomer: m.isVisibleToCustomer !== false,
      })),
    });
  }

  if (body.machineUsages) {
    await prisma.machineUsageItem.deleteMany({ where: { calculationId: id } });
    await prisma.machineUsageItem.createMany({
      data: body.machineUsages.map((m: Record<string, unknown>) => ({
        calculationId: id,
        machineId: String(m.machineId),
        description: String(m.description ?? "Maschineneinsatz"),
        usageHours: Number(m.usageHours),
        hourlyRateNet: Number(m.hourlyRateNet ?? 0),
        breakageRiskPercent: Number(m.breakageRiskPercent ?? 15),
        isVisibleToCustomer: m.isVisibleToCustomer === true,
      })),
    });
  }

  if (body.procurementCosts) {
    await prisma.procurementCost.deleteMany({ where: { calculationId: id } });
    await prisma.procurementCost.createMany({
      data: body.procurementCosts.map((p: Record<string, unknown>) => ({
        calculationId: id,
        description: String(p.description ?? "Beschaffung"),
        purchasingTimeHours: Number(p.purchasingTimeHours ?? 0),
        procurementHourlyRateNet: Number(p.procurementHourlyRateNet ?? 55),
        pickupDistanceKm: Number(p.pickupDistanceKm ?? 0),
        pickupKilometerRateNet: Number(p.pickupKilometerRateNet ?? 0),
        supplierFeesNet: Number(p.supplierFeesNet ?? 0),
        packagingHandlingNet: Number(p.packagingHandlingNet ?? 0),
        otherCostsNet: Number(p.otherCostsNet ?? 0),
        isVisibleToCustomer: p.isVisibleToCustomer === true,
      })),
    });
  }

  if (body.additionalItems) {
    await prisma.additionalCostItem.deleteMany({ where: { calculationId: id } });
    await prisma.additionalCostItem.createMany({
      data: body.additionalItems.map((a: Record<string, unknown>) => ({
        calculationId: id,
        category: a.category ?? "OTHER",
        description: String(a.description ?? "Zusatzkosten"),
        amountNet: Number(a.amountNet),
        markupPercent: Number(a.markupPercent ?? 0),
        isVisibleToCustomer: a.isVisibleToCustomer !== false,
      })),
    });
  }

  if (body.travel) {
    const t = body.travel as Record<string, unknown>;
    const existingTravel = await prisma.travelCost.findUnique({ where: { calculationId: id } });

    const numOr = (key: string, fallback: number) => {
      if (t[key] === undefined || t[key] === null || t[key] === "") return fallback;
      const n = Number(t[key]);
      return Number.isFinite(n) ? n : fallback;
    };

    const totalIsManual =
      t.totalIsManual != null
        ? Boolean(t.totalIsManual)
        : (existingTravel?.totalIsManual ?? false);
    const manualTotalNet =
      t.manualTotalNet !== undefined
        ? t.manualTotalNet === null || t.manualTotalNet === ""
          ? null
          : Number(t.manualTotalNet)
        : (existingTravel?.manualTotalNet ?? null);

    if (totalIsManual && (manualTotalNet == null || !Number.isFinite(manualTotalNet))) {
      return apiError("Bitte einen gültigen manuellen Fahrtkosten-Betrag angeben (0,00 € ist erlaubt).", 400);
    }

    await prisma.travelCost.upsert({
      where: { calculationId: id },
      create: {
        calculationId: id,
        startAddress: String(t.startAddress ?? existingTravel?.startAddress ?? "Betrieb"),
        destinationAddress: String(t.destinationAddress ?? existingTravel?.destinationAddress ?? ""),
        distanceKm: numOr("distanceKm", existingTravel?.distanceKm ?? 0),
        estimatedDriveTimeHours: numOr(
          "estimatedDriveTimeHours",
          existingTravel?.estimatedDriveTimeHours ?? 0
        ),
        kilometerRateNet: numOr("kilometerRateNet", existingTravel?.kilometerRateNet ?? 0.45),
        travelHourlyRateNet: numOr(
          "travelHourlyRateNet",
          existingTravel?.travelHourlyRateNet ?? 45
        ),
        parkingFeesNet: numOr("parkingFeesNet", existingTravel?.parkingFeesNet ?? 0),
        tollFeesNet: numOr("tollFeesNet", existingTravel?.tollFeesNet ?? 0),
        otherTravelCostsNet: numOr("otherTravelCostsNet", existingTravel?.otherTravelCostsNet ?? 0),
        selectedZoneId:
          t.selectedZoneId !== undefined
            ? ((t.selectedZoneId as string) || null)
            : (existingTravel?.selectedZoneId ?? null),
        totalIsManual,
        manualTotalNet: totalIsManual ? manualTotalNet : null,
        totalNet: totalIsManual ? Number(manualTotalNet) : 0,
        isVisibleToCustomer:
          t.isVisibleToCustomer != null
            ? Boolean(t.isVisibleToCustomer)
            : (existingTravel?.isVisibleToCustomer ?? true),
      },
      update: {
        startAddress:
          t.startAddress !== undefined
            ? String(t.startAddress)
            : (existingTravel?.startAddress ?? "Betrieb"),
        destinationAddress:
          t.destinationAddress !== undefined
            ? String(t.destinationAddress)
            : (existingTravel?.destinationAddress ?? ""),
        distanceKm: numOr("distanceKm", existingTravel?.distanceKm ?? 0),
        estimatedDriveTimeHours: numOr(
          "estimatedDriveTimeHours",
          existingTravel?.estimatedDriveTimeHours ?? 0
        ),
        kilometerRateNet: numOr("kilometerRateNet", existingTravel?.kilometerRateNet ?? 0.45),
        travelHourlyRateNet: numOr(
          "travelHourlyRateNet",
          existingTravel?.travelHourlyRateNet ?? 45
        ),
        parkingFeesNet: numOr("parkingFeesNet", existingTravel?.parkingFeesNet ?? 0),
        tollFeesNet: numOr("tollFeesNet", existingTravel?.tollFeesNet ?? 0),
        otherTravelCostsNet: numOr(
          "otherTravelCostsNet",
          existingTravel?.otherTravelCostsNet ?? 0
        ),
        ...(t.selectedZoneId !== undefined
          ? { selectedZoneId: (t.selectedZoneId as string) || null }
          : {}),
        totalIsManual,
        manualTotalNet: totalIsManual ? manualTotalNet : null,
        ...(totalIsManual ? { totalNet: Number(manualTotalNet) } : {}),
        ...(t.isVisibleToCustomer != null
          ? { isVisibleToCustomer: Boolean(t.isVisibleToCustomer) }
          : {}),
      },
    });
  }

  if (
    body.overheadPercentOverride !== undefined ||
    body.overheadAmountOverride !== undefined
  ) {
    let percent: number | null =
      body.overheadPercentOverride === undefined
        ? existing.overheadPercentOverride
        : body.overheadPercentOverride === null || body.overheadPercentOverride === ""
          ? null
          : Number(body.overheadPercentOverride);
    const amount: number | null =
      body.overheadAmountOverride === undefined
        ? existing.overheadAmountOverride
        : body.overheadAmountOverride === null || body.overheadAmountOverride === ""
          ? null
          : Number(body.overheadAmountOverride);

    if (percent != null && (!Number.isFinite(percent) || percent < 0)) {
      return apiError("Gemeinkosten-% muss 0 oder größer sein.", 400);
    }
    if (amount != null && (!Number.isFinite(amount) || amount < 0)) {
      return apiError("Gemeinkosten-Betrag muss 0 oder größer sein.", 400);
    }
    // Fester Betrag hat Vorrang vor Prozent
    if (amount != null) percent = null;

    await prisma.calculation.update({
      where: { id },
      data: {
        overheadPercentOverride: percent,
        overheadAmountOverride: amount,
      },
    });
  }

  if (body.risk) {
    await prisma.riskSettings.upsert({
      where: { calculationId: id },
      create: { calculationId: id, ...body.risk },
      update: body.risk,
    });
  }

  if (body.profit) {
    await prisma.profitSettings.upsert({
      where: { calculationId: id },
      create: { calculationId: id, ...body.profit },
      update: body.profit,
    });
  }

  if (body.incomeTax) {
    await prisma.incomeTaxSettings.upsert({
      where: { calculationId: id },
      create: { calculationId: id, ...body.incomeTax },
      update: body.incomeTax,
    });
  }

  if (body.vat) {
    const vat = body.vat as Record<string, unknown>;
    const taxTreatment =
      (vat.taxTreatment as string) ??
      (vat.reverseCharge ? "REVERSE_CHARGE" : "STANDARD_VAT");
    const reverseCharge = taxTreatment === "REVERSE_CHARGE";
    await prisma.vATSettings.upsert({
      where: { calculationId: id },
      create: {
        calculationId: id,
        vatRatePercent: Number(vat.vatRatePercent ?? 19),
        taxTreatment: taxTreatment as "STANDARD_VAT" | "REVERSE_CHARGE" | "BUILDING_EXEMPTION" | "MANUAL_REVIEW",
        reverseCharge,
        reverseChargeConfirmed: Boolean(vat.reverseChargeConfirmed),
        includeSection13bNote: vat.includeSection13bNote !== false,
        taxExempt: Boolean(vat.taxExempt),
        vatNote: (vat.vatNote as string) || null,
      },
      update: {
        vatRatePercent: Number(vat.vatRatePercent ?? 19),
        taxTreatment: taxTreatment as "STANDARD_VAT" | "REVERSE_CHARGE" | "BUILDING_EXEMPTION" | "MANUAL_REVIEW",
        reverseCharge,
        reverseChargeConfirmed: Boolean(vat.reverseChargeConfirmed),
        includeSection13bNote: vat.includeSection13bNote !== false,
        taxExempt: Boolean(vat.taxExempt),
        vatNote: (vat.vatNote as string) || null,
      },
    });
  }

  if (
    body.useFixedPrice != null ||
    body.fixedPriceNet !== undefined ||
    body.fixedPriceLabel !== undefined
  ) {
    const useFixedPrice =
      body.useFixedPrice != null ? Boolean(body.useFixedPrice) : existing.useFixedPrice;
    const fixedPriceNet =
      body.fixedPriceNet === null
        ? null
        : body.fixedPriceNet !== undefined
          ? Number(body.fixedPriceNet)
          : existing.fixedPriceNet;
    const fixedPriceLabel =
      body.fixedPriceLabel === null
        ? null
        : body.fixedPriceLabel !== undefined
          ? String(body.fixedPriceLabel).trim() || null
          : existing.fixedPriceLabel;

    if (useFixedPrice && (fixedPriceNet == null || !Number.isFinite(fixedPriceNet) || fixedPriceNet < 0)) {
      return apiError("Bitte einen gültigen Festpreis in € angeben (0,00 € ist erlaubt).", 400);
    }

    await prisma.calculation.update({
      where: { id },
      data: {
        useFixedPrice,
        fixedPriceNet: useFixedPrice ? fixedPriceNet : fixedPriceNet,
        fixedPriceLabel,
      },
    });
  }

  const result = await recalculateCalculationRecord(id, auth.tenantId);
  return apiSuccess(result);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  await prisma.calculation.deleteMany({ where: { id, tenantId: auth.tenantId } });
  return apiSuccess({ deleted: true });
}
