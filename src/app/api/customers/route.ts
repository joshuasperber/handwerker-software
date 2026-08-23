import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { parseStoredPhone, parseContactPreference, parseBooleanFlag } from "@/lib/customer-contact";

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
    orderBy: [{ company: "asc" }, { lastName: "asc" }],
  });

  return apiSuccess(customers);
}

export async function POST(request: Request) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const customerType = body.customerType === "GEWERBLICH" ? "GEWERBLICH" : "PRIVAT";
  const company = typeof body.company === "string" ? body.company.trim() : "";
  const firstName = typeof body.firstName === "string" ? body.firstName.trim() : "";
  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";

  if (customerType === "GEWERBLICH" && !company) {
    return apiError("Für Business-Kunden ist der Firmenname erforderlich.", 400);
  }
  if (!firstName || !lastName) {
    return apiError(
      customerType === "GEWERBLICH"
        ? "Bitte Vor- und Nachname des Ansprechpartners angeben."
        : "Vor- und Nachname sind erforderlich.",
      400
    );
  }

  const phoneParsed = parseStoredPhone(body.phone);
  if (!phoneParsed.ok) return apiError(phoneParsed.error, 400);

  const customer = await prisma.customer.create({
    data: {
      tenantId: auth.tenantId,
      firstName,
      lastName,
      email: body.email ?? `${firstName}.${lastName}@kunde.local`.toLowerCase(),
      phone: phoneParsed.e164,
      company: company || null,
      customerType,
      contactPerson: body.contactPerson || null,
      vatId: body.vatId || null,
      taxNumber: body.taxNumber || null,
      contactAllowed: parseBooleanFlag(body.contactAllowed, true) ?? true,
      appointmentRemindersEnabled: parseBooleanFlag(body.appointmentRemindersEnabled, true) ?? true,
      preferredContactChannel: parseContactPreference(body.preferredContactChannel) ?? "AUTO",
      billingStreet:
        body.billingStreet ||
        body.property?.street ||
        null,
      billingZipCode:
        body.billingZipCode ||
        body.property?.zipCode ||
        null,
      billingCity:
        body.billingCity ||
        body.property?.city ||
        null,
      taxNotes: body.taxNotes || null,
      notes: body.notes,
      ...(body.property
        ? {
            properties: {
              create: {
                tenantId: auth.tenantId,
                label: body.property.label ?? "Ausführungsadresse",
                street: body.property.street,
                zipCode: body.property.zipCode,
                city: body.property.city,
                latitude:
                  body.property.latitude != null &&
                  Number.isFinite(Number(body.property.latitude))
                    ? Number(body.property.latitude)
                    : null,
                longitude:
                  body.property.longitude != null &&
                  Number.isFinite(Number(body.property.longitude))
                    ? Number(body.property.longitude)
                    : null,
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
