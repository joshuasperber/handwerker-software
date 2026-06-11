import { prisma } from "@/lib/prisma";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { getReorderSuggestions } from "@/lib/inventory/reorder";
import { sendNotification } from "@/lib/notifications";
import { getTenantUserIdsByPermission } from "./recipients";
import { emptyReport, type JobReport } from "./types";

/**
 * Prueft den Bestand und benachrichtigt den Einkauf bei Unterschreitung.
 * Tages-Dedupe ueber NotificationLog (max. eine Meldung pro Tag und Tenant).
 */
export async function runReorderCheck(tenantId: string, now = new Date()): Promise<JobReport> {
  const report = emptyReport("reorder-check");
  const settings = await getOrCreateNotificationSettings(tenantId);
  if (!settings.reorderCheckEnabled) {
    report.details?.push("deaktiviert");
    return report;
  }

  const suggestions = await getReorderSuggestions(tenantId);
  if (suggestions.length === 0) {
    report.details?.push("keine Vorschläge");
    return report;
  }

  // Tages-Dedupe
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const alreadyToday = await prisma.notificationLog.findFirst({
    where: { tenantId, type: "BESTELLVORSCHLAG", sentAt: { gte: startOfDay } },
    select: { id: true },
  });
  if (alreadyToday) {
    report.skipped++;
    report.details?.push("heute bereits benachrichtigt");
    return report;
  }

  const recipients = await getTenantUserIdsByPermission(tenantId, "inventory.write");
  if (recipients.length === 0) {
    report.skipped++;
    report.details?.push("keine Empfänger");
    return report;
  }

  const top = suggestions
    .slice(0, 5)
    .map((s) => `• ${s.name}: ${s.suggestedQuantity} ${s.unit} (verfügbar ${s.available})`)
    .join("\n");
  const body =
    `${suggestions.length} Artikel benötigen eine Nachbestellung:\n\n${top}` +
    (suggestions.length > 5 ? `\n… und ${suggestions.length - 5} weitere` : "");

  await sendNotification({
    tenantId,
    type: "BESTELLVORSCHLAG",
    channel: "IN_APP",
    recipient: "intern",
    subject: `Bestellvorschläge: ${suggestions.length} Artikel`,
    body,
    metadata: { count: suggestions.length },
    inAppUserIds: recipients,
    inAppTitle: `Bestellvorschläge: ${suggestions.length} Artikel`,
    inAppLink: "/dashboard/einkauf",
  });

  if (settings.defaultEmail) {
    const users = await prisma.user.findMany({
      where: { id: { in: recipients }, email: { not: "" } },
      select: { email: true },
    });
    for (const u of users) {
      await sendNotification({
        tenantId,
        type: "BESTELLVORSCHLAG",
        channel: "EMAIL",
        recipient: u.email,
        subject: `Bestellvorschläge: ${suggestions.length} Artikel`,
        body,
        metadata: { count: suggestions.length },
      });
    }
  }

  report.processed++;
  return report;
}
