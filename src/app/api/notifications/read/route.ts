import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const body = await request.json().catch(() => ({}));
  const ids: string[] | undefined = Array.isArray(body.ids) ? body.ids : undefined;
  const all = body.all === true;

  const where = {
    userId: auth.id,
    tenantId: auth.tenantId,
    readAt: null,
    ...(all ? {} : { id: { in: ids ?? [] } }),
  };

  const res = await prisma.notification.updateMany({
    where,
    data: { readAt: new Date() },
  });

  return apiSuccess({ updated: res.count });
}
