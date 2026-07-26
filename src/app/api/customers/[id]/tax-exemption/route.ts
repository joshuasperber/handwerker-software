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
  const cert = await prisma.taxExemptionCertificate.findFirst({
    where: { customerId: id, customer: { tenantId: auth.tenantId } },
  });
  if (!cert) {
    return apiSuccess({
      hasCertificate: false,
      issuingTaxOffice: null,
      validFrom: null,
      validTo: null,
      certificateNumber: null,
      documentStorageKey: null,
      documentFileName: null,
      notes: null,
    });
  }
  return apiSuccess(cert);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("customers.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!customer) return apiError("Kunde nicht gefunden", 404);

  const body = await request.json();
  const validFrom = body.validFrom ? new Date(body.validFrom) : null;
  const validTo = body.validTo ? new Date(body.validTo) : null;

  const cert = await prisma.taxExemptionCertificate.upsert({
    where: { customerId: id },
    create: {
      customerId: id,
      hasCertificate: Boolean(body.hasCertificate),
      issuingTaxOffice: body.issuingTaxOffice || null,
      validFrom,
      validTo,
      certificateNumber: body.certificateNumber || null,
      documentFileName: body.documentFileName || null,
      documentStorageKey: body.documentStorageKey || null,
      notes: body.notes || null,
    },
    update: {
      hasCertificate: Boolean(body.hasCertificate),
      issuingTaxOffice: body.issuingTaxOffice || null,
      validFrom,
      validTo,
      certificateNumber: body.certificateNumber || null,
      documentFileName: body.documentFileName || null,
      documentStorageKey: body.documentStorageKey || null,
      notes: body.notes || null,
    },
  });

  return apiSuccess(cert);
}
