import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

/** Fortschritt der Onboarding-Checkliste nach Registrierung */
export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const [tenant, serviceCount, teamUserCount, dismissalRows] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: auth.tenantId },
      select: {
        slug: true,
        name: true,
        address: true,
        logoUrl: true,
        imprintUrl: true,
        onboardingBookingCompletedAt: true,
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
    prisma.$queryRaw<Array<{ onboardingDismissedAt: Date | null }>>`
      SELECT "onboardingDismissedAt"
      FROM "Tenant"
      WHERE "id" = ${auth.tenantId}
      LIMIT 1
    `,
  ]);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "";
  const bookingUrl = tenant ? `${appUrl}/buchen/${tenant.slug}` : null;

  const steps = {
    hasService: serviceCount > 0,
    hasTeamMember: teamUserCount > 0,
    hasBookingLink: Boolean(tenant?.onboardingBookingCompletedAt),
    hasAddress: Boolean(tenant?.address?.trim()),
    hasLogo: Boolean(tenant?.logoUrl),
    hasImprint: Boolean(tenant?.imprintUrl?.trim()),
  };

  const coreComplete =
    steps.hasService && steps.hasTeamMember && steps.hasBookingLink;
  const onboardingDismissedAt = dismissalRows[0]?.onboardingDismissedAt ?? null;

  return apiSuccess({
    steps,
    bookingUrl,
    slug: tenant?.slug ?? null,
    companyName: tenant?.name ?? null,
    doneCount: Object.values(steps).filter(Boolean).length,
    total: Object.keys(steps).length,
    complete: coreComplete,
    showChecklist:
      auth.role === "ADMIN" && !coreComplete && !onboardingDismissedAt,
  });
}

/** Mark the booking-link step only after the user actually copies or opens it. */
export async function POST() {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const tenant = await prisma.tenant.update({
    where: { id: auth.tenantId },
    data: { onboardingBookingCompletedAt: new Date() },
    select: { onboardingBookingCompletedAt: true },
  });

  return apiSuccess({ completedAt: tenant.onboardingBookingCompletedAt });
}

/** Blendet die Checkliste für diesen Betrieb dauerhaft aus. */
export async function DELETE() {
  const auth = await requireAuth("tenant.manage");
  if (auth instanceof Response) return auth;

  const dismissedAt = new Date();
  await prisma.$executeRaw`
    UPDATE "Tenant"
    SET "onboardingDismissedAt" = ${dismissedAt}, "updatedAt" = ${dismissedAt}
    WHERE "id" = ${auth.tenantId}
  `;

  return apiSuccess({ dismissedAt });
}
