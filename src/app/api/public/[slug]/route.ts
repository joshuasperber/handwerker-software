import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/api";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

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
