import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { calcTravelTotal } from "@/lib/calculation/formulas";

export async function POST(request: Request) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const distanceKm = Number(body.distanceKm);

  if (distanceKm < 0) return apiError("Entfernung darf nicht negativ sein", 400);

  const zones = await prisma.travelZone.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { sortOrder: "asc" },
  });

  const company = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  const result = calcTravelTotal({
    distanceKm,
    estimatedDriveTimeHours: Number(body.estimatedDriveTimeHours ?? 0),
    zones: zones.map((z) => ({
      name: z.name,
      minKm: z.minKm,
      maxKm: z.maxKm,
      flatFeeNet: z.flatFeeNet,
      useFormula: z.useFormula,
    })),
    kilometerRateNet: Number(body.kilometerRateNet ?? company?.defaultKilometerRate ?? 0.45),
    travelHourlyRateNet: Number(body.travelHourlyRateNet ?? company?.defaultTravelHourlyRate ?? 45),
    parkingFeesNet: Number(body.parkingFeesNet ?? 0),
    tollFeesNet: Number(body.tollFeesNet ?? 0),
    otherTravelCostsNet: Number(body.otherTravelCostsNet ?? 0),
  });

  const zone = zones.find((z) => z.name === result.zoneName);

  return apiSuccess({ ...result, selectedZoneId: zone?.id });
}
