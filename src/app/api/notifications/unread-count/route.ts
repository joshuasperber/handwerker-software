import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const unreadCount = await prisma.notification.count({
    where: { userId: auth.id, tenantId: auth.tenantId, readAt: null },
  });

  return apiSuccess({ unreadCount });
}
