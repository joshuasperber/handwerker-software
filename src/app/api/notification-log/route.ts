import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("notifications.manage");
  if (auth instanceof Response) return auth;

  const logs = await prisma.notificationLog.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { sentAt: "desc" },
    take: 50,
  });

  return apiSuccess(
    logs.map((l) => ({
      id: l.id,
      type: l.type,
      channel: l.channel,
      recipient: l.recipient,
      subject: l.subject,
      sentAt: l.sentAt.toISOString(),
    }))
  );
}
