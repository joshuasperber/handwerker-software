import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await requireAuth("audit.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const entityType = searchParams.get("entityType");
  const entityId = searchParams.get("entityId");

  const logs = await prisma.auditLog.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return apiSuccess(logs);
}
