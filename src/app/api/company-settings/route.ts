import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  normalizeHexColor,
  parseInvoiceFontScale,
  parseInvoiceLayout,
  parseInvoiceTemplate,
} from "@/lib/documents/invoice-design";
import { toInvoiceLogoSrc, toTenantLogoSrc } from "@/lib/logo";
import { hasStoredImage, persistableImageUrl } from "@/lib/stored-image";
import { tenantToCompanyDefaults } from "@/lib/company-settings-defaults";

function toCompanyDTO<T extends { invoiceLogoUrl: string | null; updatedAt: Date }>(
  company: T | null
) {
  if (!company) return null;
  return {
    ...company,
    invoiceLogoUrl: toInvoiceLogoSrc(company.invoiceLogoUrl, company.updatedAt) ?? "",
    hasInvoiceLogo: hasStoredImage(company.invoiceLogoUrl),
  };
}

export async function GET() {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const [company, overhead, tenant] = await Promise.all([
    prisma.companySettings.findUnique({ where: { tenantId: auth.tenantId } }),
    prisma.overheadSettings.findUnique({ where: { tenantId: auth.tenantId } }),
    prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: {
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        zipCode: true,
        primaryColor: true,
        logoUrl: true,
        updatedAt: true,
      },
    }),
  ]);

  const tenantDefaults = tenant
    ? tenantToCompanyDefaults({
        ...tenant,
        logoUrl: toTenantLogoSrc(tenant.logoUrl, tenant.updatedAt),
      })
    : null;

  return apiSuccess({ company: toCompanyDTO(company), overhead, tenantDefaults });
}

export async function PUT(request: Request) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const { company, overhead } = body;

  let companyRecord = await prisma.companySettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  if (company) {
    const data = {
      companyName: company.companyName ?? "Mein Betrieb",
      street: company.street,
      houseNumber: company.houseNumber,
      postalCode: company.postalCode,
      city: company.city,
      country: company.country ?? "DE",
      defaultVatRate: company.defaultVatRate != null ? Number(company.defaultVatRate) : undefined,
      defaultHourlyRate: company.defaultHourlyRate != null ? Number(company.defaultHourlyRate) : undefined,
      defaultWorkshopHourlyRate:
        company.defaultWorkshopHourlyRate != null ? Number(company.defaultWorkshopHourlyRate) : undefined,
      defaultMaterialMarkupPercent:
        company.defaultMaterialMarkupPercent != null
          ? Number(company.defaultMaterialMarkupPercent)
          : undefined,
      defaultProcurementHourlyRate:
        company.defaultProcurementHourlyRate != null
          ? Number(company.defaultProcurementHourlyRate)
          : undefined,
      defaultRiskPercent: company.defaultRiskPercent != null ? Number(company.defaultRiskPercent) : undefined,
      defaultProfitPercent:
        company.defaultProfitPercent != null ? Number(company.defaultProfitPercent) : undefined,
      defaultIncomeTaxPercent:
        company.defaultIncomeTaxPercent != null ? Number(company.defaultIncomeTaxPercent) : undefined,
      defaultKilometerRate:
        company.defaultKilometerRate != null ? Number(company.defaultKilometerRate) : undefined,
      defaultTravelHourlyRate:
        company.defaultTravelHourlyRate != null ? Number(company.defaultTravelHourlyRate) : undefined,
      defaultOverheadPercent:
        company.defaultOverheadPercent != null ? Number(company.defaultOverheadPercent) : undefined,
      additionalOverheadPercent:
        company.additionalOverheadPercent != null
          ? Number(company.additionalOverheadPercent)
          : undefined,
      // Kontaktdaten für Dokumente
      phone: company.phone !== undefined ? (company.phone || null) : undefined,
      email: company.email !== undefined ? (company.email || null) : undefined,
      website: company.website !== undefined ? (company.website || null) : undefined,
      // Rechnungs-Personalisierung — Logo nur als kurze URL, nie als Data-URL
      invoiceLogoUrl: persistableImageUrl(company.invoiceLogoUrl),
      bankName: company.bankName !== undefined ? (company.bankName || null) : undefined,
      iban: company.iban !== undefined ? (company.iban || null) : undefined,
      bic: company.bic !== undefined ? (company.bic || null) : undefined,
      taxNumber: company.taxNumber !== undefined ? (company.taxNumber || null) : undefined,
      vatId: company.vatId !== undefined ? (company.vatId || null) : undefined,
      paymentTermsDays:
        company.paymentTermsDays != null ? Number(company.paymentTermsDays) : undefined,
      invoiceIntroText:
        company.invoiceIntroText !== undefined ? (company.invoiceIntroText || null) : undefined,
      invoiceFooterText:
        company.invoiceFooterText !== undefined ? (company.invoiceFooterText || null) : undefined,
      invoiceNotes: company.invoiceNotes !== undefined ? (company.invoiceNotes || null) : undefined,
      invoiceLegalText:
        company.invoiceLegalText !== undefined ? (company.invoiceLegalText || null) : undefined,
      invoiceAccentColor:
        company.invoiceAccentColor !== undefined
          ? normalizeHexColor(company.invoiceAccentColor)
          : undefined,
      invoiceLayout:
        company.invoiceLayout !== undefined ? parseInvoiceLayout(company.invoiceLayout) : undefined,
      invoiceFontScale:
        company.invoiceFontScale !== undefined
          ? parseInvoiceFontScale(company.invoiceFontScale)
          : undefined,
      invoiceTemplate:
        company.invoiceTemplate !== undefined
          ? parseInvoiceTemplate(company.invoiceTemplate)
          : undefined,
    };

    companyRecord = companyRecord
      ? await prisma.companySettings.update({
          where: { tenantId: auth.tenantId },
          data,
        })
      : await prisma.companySettings.create({
          data: { tenantId: auth.tenantId, ...data },
        });
  }

  let overheadRecord = await prisma.overheadSettings.findUnique({
    where: { tenantId: auth.tenantId },
  });

  if (overhead) {
    const overheadData = {
      productiveHoursPerMonth:
        overhead.productiveHoursPerMonth != null
          ? Number(overhead.productiveHoursPerMonth)
          : undefined,
      overheadCalculationMode: overhead.overheadCalculationMode,
      overheadPercent: overhead.overheadPercent != null ? Number(overhead.overheadPercent) : undefined,
    };

    overheadRecord = overheadRecord
      ? await prisma.overheadSettings.update({
          where: { tenantId: auth.tenantId },
          data: overheadData,
        })
      : await prisma.overheadSettings.create({
          data: { tenantId: auth.tenantId, ...overheadData },
        });
  }

  if (!companyRecord && !overheadRecord) {
    return apiError("Keine Daten zum Speichern", 400);
  }

  return apiSuccess({ company: toCompanyDTO(companyRecord), overhead: overheadRecord });
}
