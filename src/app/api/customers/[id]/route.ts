import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      properties: {
        include: { travelZone: true },
        orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
      },
      taxExemptionCertificate: true,
      orders: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!customer) return apiError("Kunde nicht gefunden", 404);
  return apiSuccess(customer);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.customer.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Kunde nicht gefunden", 404);

  const customer = await prisma.customer.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined ? { firstName: body.firstName } : {}),
      ...(body.lastName !== undefined ? { lastName: body.lastName } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
      ...(body.phone !== undefined ? { phone: body.phone } : {}),
      ...(body.company !== undefined ? { company: body.company } : {}),
      ...(body.customerType !== undefined ? { customerType: body.customerType } : {}),
      ...(body.contactPerson !== undefined ? { contactPerson: body.contactPerson || null } : {}),
      ...(body.vatId !== undefined ? { vatId: body.vatId || null } : {}),
      ...(body.taxNumber !== undefined ? { taxNumber: body.taxNumber || null } : {}),
      ...(body.billingStreet !== undefined ? { billingStreet: body.billingStreet || null } : {}),
      ...(body.billingZipCode !== undefined ? { billingZipCode: body.billingZipCode || null } : {}),
      ...(body.billingCity !== undefined ? { billingCity: body.billingCity || null } : {}),
      ...(body.taxNotes !== undefined ? { taxNotes: body.taxNotes || null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.bookingConfirmationEmailTemplate !== undefined
        ? { bookingConfirmationEmailTemplate: body.bookingConfirmationEmailTemplate || null }
        : {}),
    },
    include: { properties: true, taxExemptionCertificate: true },
  });

  return apiSuccess(customer);
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.customer.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: { _count: { select: { orders: true } } },
  });
  if (!existing) return apiError("Kunde nicht gefunden", 404);
  if (existing._count.orders > 0) {
    return apiError("Kunde hat noch Aufträge und kann nicht gelöscht werden", 400);
  }

  await prisma.customer.delete({ where: { id } });
  return apiSuccess({ deleted: true });
}
