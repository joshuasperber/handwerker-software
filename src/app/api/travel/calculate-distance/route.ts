import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  estimateDriveTimeHours,
  estimateRoadDistanceKm,
  geocodeAddress,
} from "@/lib/calculation/travel-distance";

export async function POST(request: Request) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const company = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  let distanceKm = body.distanceKm != null ? Number(body.distanceKm) : null;
  let driveTimeHours =
    body.estimatedDriveTimeHours != null
      ? Number(body.estimatedDriveTimeHours)
      : null;

  const startAddress =
    body.startAddress ??
    [company?.street, company?.houseNumber, company?.postalCode, company?.city]
      .filter(Boolean)
      .join(", ");

  const destAddress = body.destinationAddress;
  if (!destAddress) return apiError("Zieladresse fehlt", 400);

  if (distanceKm == null && company?.latitude != null && company?.longitude != null) {
    const dest = await geocodeAddress(destAddress);
    if (dest) {
      distanceKm = estimateRoadDistanceKm(
        company.latitude,
        company.longitude,
        dest.lat,
        dest.lon
      );
    }
  }

  if (distanceKm == null && body.manualDistanceKm != null) {
    distanceKm = Number(body.manualDistanceKm);
  }

  if (distanceKm == null) {
    return apiError(
      "Entfernung konnte nicht berechnet werden. Bitte manuell eingeben oder Karten-API konfigurieren.",
      400
    );
  }

  if (driveTimeHours == null) {
    driveTimeHours = estimateDriveTimeHours(distanceKm);
  }

  return apiSuccess({
    startAddress,
    destinationAddress: destAddress,
    distanceKm,
    estimatedDriveTimeHours: driveTimeHours,
    source: company?.latitude ? "geocode_estimate" : "manual",
  });
}
