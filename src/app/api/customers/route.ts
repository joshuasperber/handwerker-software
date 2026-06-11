import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("customers.read");
  if (auth instanceof Response) return auth;

  const customers = await prisma.customer.findMany({
    where: { tenantId: auth.tenantId },
    include: {
      properties: {
        include: { travelZone: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      _count: { select: { orders: true } },
    },
    orderBy: { lastName: "asc" },
  });

  return apiSuccess(customers);
}

export async function POST(request: Request) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();

  const customer = await prisma.customer.create({
    data: {
      tenantId: auth.tenantId,
      firstName: body.firstName,
      lastName: body.lastName,
      email: body.email ?? `${body.firstName}.${body.lastName}@kunde.local`.toLowerCase(),
      phone: body.phone,
      company: body.company,
      notes: body.notes,
      ...(body.property
        ? {
            properties: {
              create: {
                tenantId: auth.tenantId,
                label: body.property.label ?? "Hauptadresse",
                street: body.property.street,
                zipCode: body.property.zipCode,
                city: body.property.city,
                // Bei der Erstanlage ist die erste Adresse immer die Hauptadresse.
                isPrimary: true,
                isActive: true,
                travelZoneId: body.property.travelZoneId || null,
              },
            },
          }
        : {}),
    },
    include: { properties: true },
  });

  return apiSuccess(customer, 201);
}
