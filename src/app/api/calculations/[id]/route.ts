import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { recalculateCalculationRecord } from "@/lib/calculation/recalculate-db";

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

  if (body.title != null) {
    await prisma.calculation.update({
      where: { id },
      data: { title: body.title, currentStep: body.currentStep, customerId: body.customerId },
    });
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
        name: String(m.name),
        quantity: Number(m.quantity),
        unit: String(m.unit ?? "Stk"),
        purchasePriceNet: Number(m.purchasePriceNet),
        markupPercent: Number(m.markupPercent ?? 25),
        wastePercent: Number(m.wastePercent ?? 0),
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
    const t = body.travel;
    await prisma.travelCost.upsert({
      where: { calculationId: id },
      create: {
        calculationId: id,
        startAddress: t.startAddress,
        destinationAddress: t.destinationAddress,
        distanceKm: Number(t.distanceKm),
        estimatedDriveTimeHours: Number(t.estimatedDriveTimeHours ?? 0),
        kilometerRateNet: Number(t.kilometerRateNet ?? 0.45),
        travelHourlyRateNet: Number(t.travelHourlyRateNet ?? 45),
        parkingFeesNet: Number(t.parkingFeesNet ?? 0),
        tollFeesNet: Number(t.tollFeesNet ?? 0),
        otherTravelCostsNet: Number(t.otherTravelCostsNet ?? 0),
      },
      update: {
        startAddress: t.startAddress,
        destinationAddress: t.destinationAddress,
        distanceKm: Number(t.distanceKm),
        estimatedDriveTimeHours: Number(t.estimatedDriveTimeHours ?? 0),
        kilometerRateNet: Number(t.kilometerRateNet),
        travelHourlyRateNet: Number(t.travelHourlyRateNet),
        parkingFeesNet: Number(t.parkingFeesNet ?? 0),
        tollFeesNet: Number(t.tollFeesNet ?? 0),
        otherTravelCostsNet: Number(t.otherTravelCostsNet ?? 0),
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
    await prisma.vATSettings.upsert({
      where: { calculationId: id },
      create: { calculationId: id, ...body.vat },
      update: body.vat,
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
