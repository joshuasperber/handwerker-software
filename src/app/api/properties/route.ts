import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { customerId, label, street, zipCode, city, notes } = body;

  if (!customerId || !street || !zipCode || !city) {
    return apiError("Kunde, Straße, PLZ und Ort sind Pflicht", 400);
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, tenantId: auth.tenantId },
  });
  if (!customer) return apiError("Kunde nicht gefunden", 404);

  const property = await prisma.property.create({
    data: {
      tenantId: auth.tenantId,
      customerId,
      label: label ?? "Einsatzort",
      street,
      zipCode,
      city,
      notes,
    },
  });

  return apiSuccess(property, 201);
}
