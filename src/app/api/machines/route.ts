import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { recalculateMachineHourlyRate } from "@/lib/calculation/recalculate-db";

export async function GET() {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const machines = await prisma.machine.findMany({
    where: { tenantId: auth.tenantId, isActive: true },
    orderBy: { name: "asc" },
  });

  return apiSuccess(machines);
}

export async function POST(request: Request) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  if (!body.name) return apiError("Name erforderlich", 400);

  const costMethod = body.costMethod === "FLAT_RATE" ? "FLAT_RATE" : "AMORTIZATION";
  if (costMethod === "FLAT_RATE" && !(Number(body.flatRatePerHourNet) > 0)) {
    return apiError("Pauschale pro Stunde erforderlich", 400);
  }
  if (costMethod === "AMORTIZATION" && (!body.purchasePriceNet || !body.expectedLifetimeHours)) {
    return apiError("Anschaffung und Nutzungsstunden erforderlich", 400);
  }

  const machine = await prisma.machine.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      machineType: body.machineType,
      costMethod,
      flatRatePerHourNet: costMethod === "FLAT_RATE" ? Number(body.flatRatePerHourNet) : null,
      purchasePriceNet: Number(body.purchasePriceNet ?? 0),
      residualValueNet: Number(body.residualValueNet ?? 0),
      expectedLifetimeHours: Number(body.expectedLifetimeHours ?? 1),
      expectedRepairCostsNet: Number(body.expectedRepairCostsNet ?? 0),
      expectedMaintenanceCostsNet: Number(body.expectedMaintenanceCostsNet ?? 0),
      expectedConsumablePartsNet: Number(body.expectedConsumablePartsNet ?? 0),
      insuranceCostsNet: Number(body.insuranceCostsNet ?? 0),
      energyCostsTotalNet: Number(body.energyCostsTotalNet ?? 0),
      breakageRiskPercent: Number(body.breakageRiskPercent ?? 15),
    },
  });

  await recalculateMachineHourlyRate(machine.id, auth.tenantId);
  const updated = await prisma.machine.findUnique({ where: { id: machine.id } });
  return apiSuccess(updated, 201);
}
