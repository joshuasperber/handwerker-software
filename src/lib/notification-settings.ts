import { prisma } from "@/lib/prisma";

/** Liefert die Benachrichtigungs-Einstellungen eines Tenants und legt Defaults an, falls noch keine existieren. */
export async function getOrCreateNotificationSettings(tenantId: string) {
  const existing = await prisma.notificationSettings.findUnique({ where: { tenantId } });
  if (existing) return existing;
  return prisma.notificationSettings.create({ data: { tenantId } });
}
