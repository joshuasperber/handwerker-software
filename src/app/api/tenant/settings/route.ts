import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { toTenantLogoSrc } from "@/lib/logo";
import { hasStoredImage, persistableImageUrl } from "@/lib/stored-image";
import { tenantToCompanyDefaults } from "@/lib/company-settings-defaults";
import { normalizeOptionalHttpUrl } from "@/lib/external-url";

function toTenantDTO<
  T extends { logoUrl: string | null; updatedAt?: Date; slug: string },
>(tenant: T, bookingUrl: string) {
  return {
    ...tenant,
    logoUrl: toTenantLogoSrc(tenant.logoUrl, tenant.updatedAt) ?? null,
    hasLogo: hasStoredImage(tenant.logoUrl),
    bookingUrl,
  };
}

function bookingUrlFor(slug: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  return `${appUrl}/buchen/${slug}`;
}

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
      termsUrl: true,
      bufferMinutes: true,
      updatedAt: true,
    },
  });

  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

  return apiSuccess(toTenantDTO(tenant, bookingUrlFor(tenant.slug)));
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const body = await request.json();

  let privacyPolicyUrl: string | null | undefined;
  let imprintUrl: string | null | undefined;
  let termsUrl: string | null | undefined;
  try {
    privacyPolicyUrl = normalizeOptionalHttpUrl(body.privacyPolicyUrl, "Datenschutz-URL");
    imprintUrl = normalizeOptionalHttpUrl(body.imprintUrl, "Impressum-URL");
    termsUrl = normalizeOptionalHttpUrl(body.termsUrl, "AGB-URL");
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "Rechtliche URL ist ungültig");
  }

  const data = {
    name: typeof body.name === "string" ? body.name.trim() : undefined,
    email: typeof body.email === "string" ? body.email.trim() : undefined,
    phone: body.phone !== undefined ? (body.phone || null) : undefined,
    address: body.address !== undefined ? (body.address || null) : undefined,
    city: body.city !== undefined ? (body.city || null) : undefined,
    zipCode: body.zipCode !== undefined ? (body.zipCode || null) : undefined,
    logoUrl: persistableImageUrl(body.logoUrl),
    primaryColor:
      typeof body.primaryColor === "string" ? body.primaryColor : undefined,
    privacyPolicyUrl,
    imprintUrl,
    termsUrl,
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

  // Create invoice defaults once. Existing invoice settings remain independent
  // and can be refreshed explicitly from the invoice-settings screen.
  const company = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });
  if (!company) {
    const defaults = tenantToCompanyDefaults({ ...tenant, logoUrl: null });
    await prisma.companySettings.create({
      data: {
        tenantId: auth.tenantId,
        companyName: defaults.companyName,
        email: defaults.email,
        phone: defaults.phone || null,
        street: defaults.street || null,
        houseNumber: defaults.houseNumber || null,
        city: defaults.city || null,
        postalCode: defaults.postalCode || null,
        invoiceAccentColor: defaults.invoiceAccentColor,
      },
    });
  }

  return apiSuccess(toTenantDTO(tenant, bookingUrlFor(tenant.slug)));
}
