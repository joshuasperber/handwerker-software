import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

/** Ungelesene Direktnachrichten für Sidebar-Badge */
export async function GET() {
  const auth = await requireAuth("messages.read");
  if (auth instanceof Response) return auth;

  const count = await prisma.message.count({
    where: {
      tenantId: auth.tenantId,
      recipientUserId: auth.id,
      readAt: null,
    },
  });

  return apiSuccess({ count });
}
