import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";

export async function GET() {
  const auth = await requireAuth("notifications.manage");
  if (auth instanceof Response) return auth;

  const settings = await getOrCreateNotificationSettings(auth.tenantId);
  return apiSuccess(settings);
}

const schema = z.object({
  appointmentReminderEnabled: z.boolean().optional(),
  appointmentReminderHoursBefore: z.number().int().min(1).max(336).optional(),
  remindCustomer: z.boolean().optional(),
  remindEmployee: z.boolean().optional(),
  dunningAutoEnabled: z.boolean().optional(),
  dunningLevel1Days: z.number().int().min(0).max(180).optional(),
  dunningLevel2Days: z.number().int().min(0).max(180).optional(),
  dunningLevel3Days: z.number().int().min(0).max(180).optional(),
  reorderCheckEnabled: z.boolean().optional(),
  defaultEmail: z.boolean().optional(),
  defaultSms: z.boolean().optional(),
  reminderEmailTemplate: z.string().max(2000).optional().nullable(),
  dunningEmailTemplate: z.string().max(2000).optional().nullable(),
});

export async function PUT(request: Request) {
  const auth = await requireAuth("notifications.manage");
  if (auth instanceof Response) return auth;

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", 400);
  }

  await getOrCreateNotificationSettings(auth.tenantId);
  const updated = await prisma.notificationSettings.update({
    where: { tenantId: auth.tenantId },
    data: parsed.data,
  });

  return apiSuccess(updated);
}
