import { requireAuth, apiSuccess } from "@/lib/api";
import { getEmailChannelStatus, getMessagingStatus } from "@/lib/messaging/config";

/** Liefert nur den Messaging-Status, ohne Prisma-Einstellungen. */
export async function GET() {
  const auth = await requireAuth("notifications.manage");
  if (auth instanceof Response) return auth;

  return apiSuccess({
    email: getEmailChannelStatus(),
    messaging: getMessagingStatus("SMS"),
  });
}
