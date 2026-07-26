import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      phone: true,
      address: true,
      city: true,
      zipCode: true,
      logoUrl: true,
      primaryColor: true,
      privacyPolicyUrl: true,
      imprintUrl: true,
      bufferMinutes: true,
    },
  });

  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  return apiSuccess({
    ...tenant,
    bookingUrl: `${appUrl}/buchen/${tenant.slug}`,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const body = await request.json();

  const data = {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    email: typeof body.email === "string" ? body.email.trim() : undefined,
    phone: body.phone !== undefined ? (body.phone || null) : undefined,
    address: body.address !== undefined ? (body.address || null) : undefined,
    city: body.city !== undefined ? (body.city || null) : undefined,
    zipCode: body.zipCode !== undefined ? (body.zipCode || null) : undefined,
    logoUrl: body.logoUrl !== undefined ? (body.logoUrl || null) : undefined,
    primaryColor:
      typeof body.primaryColor === "string" ? body.primaryColor : undefined,
    privacyPolicyUrl:
      body.privacyPolicyUrl !== undefined
        ? body.privacyPolicyUrl || null
        : undefined,
    imprintUrl:
      body.imprintUrl !== undefined ? body.imprintUrl || null : undefined,
    bufferMinutes:
      body.bufferMinutes != null ? Number(body.bufferMinutes) : undefined,
  };

  // Remove undefined keys
  const clean = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  );

  if (clean.name !== undefined && String(clean.name).length < 2) {
    return apiError("Betriebsname zu kurz");
  }

  const tenant = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: clean,
  });

  // Sync core fields into CompanySettings if present
  const company = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });
  if (company) {
    await prisma.companySettings.update({
      where: { tenantId: auth.tenantId },
      data: {
        ...(data.name ? { companyName: data.name as string } : {}),
        ...(data.email !== undefined
          ? { email: (data.email as string | null) ?? undefined }
          : {}),
        ...(data.phone !== undefined
          ? { phone: data.phone as string | null }
          : {}),
        ...(data.address !== undefined
          ? { street: data.address as string | null }
          : {}),
        ...(data.city !== undefined ? { city: data.city as string | null } : {}),
        ...(data.zipCode !== undefined
          ? { postalCode: data.zipCode as string | null }
          : {}),
        ...(data.logoUrl !== undefined
          ? { invoiceLogoUrl: data.logoUrl as string | null }
          : {}),
      },
    });
  } else if (data.name) {
    await prisma.companySettings.create({
      data: {
        tenantId: auth.tenantId,
        companyName: data.name as string,
        email: (data.email as string | undefined) ?? tenant.email,
        phone: (data.phone as string | null | undefined) ?? tenant.phone,
        street: (data.address as string | null | undefined) ?? tenant.address,
        city: (data.city as string | null | undefined) ?? tenant.city,
        postalCode:
          (data.zipCode as string | null | undefined) ?? tenant.zipCode,
        invoiceLogoUrl:
          (data.logoUrl as string | null | undefined) ?? tenant.logoUrl,
      },
    });
  }

  return apiSuccess(tenant);
}
