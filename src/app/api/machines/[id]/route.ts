import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { recalculateMachineHourlyRate } from "@/lib/calculation/recalculate-db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.machine.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!existing) return apiError("Maschine nicht gefunden", 404);

  await prisma.machine.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.machineType !== undefined ? { machineType: body.machineType } : {}),
      ...(body.purchasePriceNet !== undefined ? { purchasePriceNet: Number(body.purchasePriceNet) } : {}),
      ...(body.residualValueNet !== undefined ? { residualValueNet: Number(body.residualValueNet) } : {}),
      ...(body.expectedLifetimeHours !== undefined ? { expectedLifetimeHours: Number(body.expectedLifetimeHours) } : {}),
      ...(body.expectedRepairCostsNet !== undefined ? { expectedRepairCostsNet: Number(body.expectedRepairCostsNet) } : {}),
      ...(body.expectedMaintenanceCostsNet !== undefined ? { expectedMaintenanceCostsNet: Number(body.expectedMaintenanceCostsNet) } : {}),
      ...(body.expectedConsumablePartsNet !== undefined ? { expectedConsumablePartsNet: Number(body.expectedConsumablePartsNet) } : {}),
      ...(body.insuranceCostsNet !== undefined ? { insuranceCostsNet: Number(body.insuranceCostsNet) } : {}),
      ...(body.energyCostsTotalNet !== undefined ? { energyCostsTotalNet: Number(body.energyCostsTotalNet) } : {}),
      ...(body.breakageRiskPercent !== undefined ? { breakageRiskPercent: Number(body.breakageRiskPercent) } : {}),
      ...(body.costMethod !== undefined ? { costMethod: body.costMethod } : {}),
      ...(body.flatRatePerHourNet !== undefined ? { flatRatePerHourNet: body.flatRatePerHourNet ? Number(body.flatRatePerHourNet) : null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  await recalculateMachineHourlyRate(id, auth.tenantId);
  const updated = await prisma.machine.findUnique({ where: { id } });
  return apiSuccess(updated);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.machine.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!existing) return apiError("Maschine nicht gefunden", 404);

  await prisma.machine.update({ where: { id }, data: { isActive: false } });
  return apiSuccess({ deactivated: true });
}
