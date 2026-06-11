import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const zones = await prisma.travelZone.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return apiSuccess(zones);
}

/** Validierung: Name Pflicht, Preis darf nicht fehlen/0 sein (außer Formel-Zone). */
export function validateZonePayload(body: Record<string, unknown>): string | null {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return "Name der Zone ist erforderlich.";

  const useFormula = body.useFormula === true;
  if (!useFormula) {
    const fee = Number(body.flatFeeNet);
    if (!Number.isFinite(fee)) return "Preis der Zone ist erforderlich.";
    if (fee <= 0) return "Preis der Zone muss größer als 0 € sein.";
  }

  if (body.minKm != null && Number(body.minKm) < 0)
    return "Mindest-km darf nicht negativ sein.";
  if (body.maxKm != null && body.maxKm !== "" && Number(body.maxKm) < Number(body.minKm ?? 0))
    return "Maximal-km muss größer als Mindest-km sein.";

  return null;
}

export async function POST(request: Request) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const validationError = validateZonePayload(body);
  if (validationError) return apiError(validationError, 400);

  const useFormula = body.useFormula === true;

  const count = await prisma.travelZone.count({ where: { tenantId: auth.tenantId } });

  const zone = await prisma.travelZone.create({
    data: {
      tenantId: auth.tenantId,
      name: String(body.name).trim(),
      description: body.description ? String(body.description) : null,
      minKm: body.minKm != null && body.minKm !== "" ? Number(body.minKm) : 0,
      maxKm: body.maxKm != null && body.maxKm !== "" ? Number(body.maxKm) : null,
      flatFeeNet: useFormula ? 0 : Number(body.flatFeeNet),
      useFormula,
      isActive: body.isActive !== false,
      sortOrder: body.sortOrder != null ? Number(body.sortOrder) : count + 1,
    },
  });

  return apiSuccess(zone, 201);
}
