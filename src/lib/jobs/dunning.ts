import { prisma } from "@/lib/prisma";
import { getOrCreateNotificationSettings } from "@/lib/notification-settings";
import { createDunningForDocument } from "@/lib/documents/dunning";
import { emptyReport, type JobReport } from "./types";

/**
 * Automatischer Mahnlauf: erhoeht die Mahnstufe ueberfaelliger Rechnungen,
 * sobald die in den Einstellungen hinterlegten Tagesgrenzen erreicht sind.
 */
export async function runDunning(tenantId: string, now = new Date()): Promise<JobReport> {
  const report = emptyReport("dunning");
  const settings = await getOrCreateNotificationSettings(tenantId);
  if (!settings.dunningAutoEnabled) {
    report.details?.push("deaktiviert");
    return report;
  }

  const thresholdForLevel: Record<number, number> = {
    1: settings.dunningLevel1Days,
    2: settings.dunningLevel2Days,
    3: settings.dunningLevel3Days,
  };

  const invoices = await prisma.calculationDocument.findMany({
    where: {
      documentType: "INVOICE",
      status: { in: ["OFFEN", "TEILBEZAHLT"] },
      dueDate: { lt: now },
      calculation: { tenantId },
    },
    select: { id: true, dueDate: true, _count: { select: { dunningNotices: true } } },
  });

  for (const inv of invoices) {
    const existing = inv._count.dunningNotices;
    const nextLevel = existing + 1;
    if (nextLevel > 3 || !inv.dueDate) {
      report.skipped++;
      continue;
    }

    const overdueDays = Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000);
    if (overdueDays < thresholdForLevel[nextLevel]) {
      report.skipped++;
      continue;
    }

    const result = await createDunningForDocument({ tenantId, documentId: inv.id });
    if (result.ok) {
      report.processed++;
    } else {
      report.errors++;
      report.details?.push(`Rechnung ${inv.id}: ${result.error}`);
    }
  }

  return report;
}
