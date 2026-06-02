import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api";

function getTenantSlug(request: NextRequest): string | null {
  return new URL(request.url).searchParams.get("tenant");
}

export async function GET(request: NextRequest) {
  const slug = getTenantSlug(request);
  if (!slug) return apiError("Parameter 'tenant' fehlt", 400);

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      phone: true,
      primaryColor: true,
      privacyPolicyUrl: true,
      imprintUrl: true,
    },
  });

  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

  const services = await prisma.service.findMany({
    where: { tenantId: tenant.id, isActive: true },
    include: { questions: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return apiSuccess({ tenant, services });
}
