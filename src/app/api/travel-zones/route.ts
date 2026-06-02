import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const zones = await prisma.travelZone.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { sortOrder: "asc" },
  });

  return apiSuccess(zones);
}
