import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

/** Fortschritt der Onboarding-Checkliste nach Registrierung */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const [tenant, serviceCount, teamUserCount] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: {
        slug: true,
        name: true,
        address: true,
        logoUrl: true,
        imprintUrl: true,
      },
    }),
    prisma.service.count({ where: { tenantId: auth.tenantId, isActive: true } }),
    prisma.user.count({
      where: {
        tenantId: auth.tenantId,
        isActive: true,
        role: { in: ["MONTEUR", "MEISTER", "BUERO"] },
      },
    }),
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const bookingUrl = tenant ? `${appUrl}/buchen/${tenant.slug}` : null;

  const steps = {
    hasService: serviceCount > 0,
    hasTeamMember: teamUserCount > 0,
    hasBookingLink: Boolean(tenant?.slug),
    hasAddress: Boolean(tenant?.address?.trim()),
    hasLogo: Boolean(tenant?.logoUrl),
    hasImprint: Boolean(tenant?.imprintUrl?.trim()),
  };

  const coreComplete =
    steps.hasService && steps.hasTeamMember && steps.hasBookingLink;

  return apiSuccess({
    steps,
    bookingUrl,
    slug: tenant?.slug ?? null,
    companyName: tenant?.name ?? null,
    doneCount: Object.values(steps).filter(Boolean).length,
    total: Object.keys(steps).length,
    complete: coreComplete,
    showChecklist: auth.role === "ADMIN" && !coreComplete,
  });
}
