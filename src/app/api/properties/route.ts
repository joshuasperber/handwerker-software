import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { customerId, label, street, zipCode, city, notes, travelZoneId } = body;

  if (!customerId || !street || !zipCode || !city) {
    return apiError("Kunde, Straße, PLZ und Ort sind Pflicht", 400);
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: auth.tenantId },
  });
  if (!customer) return apiError("Kunde nicht gefunden", 404);

  // Erste Adresse eines Kunden wird automatisch zur Hauptadresse.
  const existingCount = await prisma.property.count({
    where: { tenantId: auth.tenantId, customerId },
  });
  const isPrimary = body.isPrimary === true || existingCount === 0;

  const property = await prisma.$transaction(async (tx) => {
    if (isPrimary) {
      await tx.property.updateMany({
        where: { tenantId: auth.tenantId, customerId },
        data: { isPrimary: false },
      });
    }
    return tx.property.create({
      data: {
        tenantId: auth.tenantId,
        customerId,
        label: label ?? "Einsatzort",
        street,
        zipCode,
        city,
        notes,
        isPrimary,
        isActive: body.isActive !== false,
        travelZoneId: travelZoneId || null,
      },
      include: { travelZone: true },
    });
  });

  return apiSuccess(property, 201);
}
