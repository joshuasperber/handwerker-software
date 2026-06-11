import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const unreadOnly = searchParams.get("unread") === "1";

  const items = await prisma.notification.findMany({
    where: {
      userId: auth.id,
      tenantId: auth.tenantId,
      ...(unreadOnly ? { readAt: null } : {}),
    },
    orderBy: [{ readAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
    take: 50,
  });

  const unreadCount = await prisma.notification.count({
    where: { userId: auth.id, tenantId: auth.tenantId, readAt: null },
  });

  return apiSuccess({
    items: items.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      readAt: n.readAt?.toISOString() ?? null,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  });
}
