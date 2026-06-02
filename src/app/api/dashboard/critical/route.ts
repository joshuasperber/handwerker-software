import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { calcAvailableQuantity } from "@/lib/inventory/formulas";

export async function GET() {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const warnings: {
    type: string;
    severity: "red" | "yellow";
    title: string;
    detail: string;
    orderId?: string;
    articleId?: string;
  }[] = [];

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const todayOrders = await prisma.order.findMany({
    where: {
      tenantId: auth.tenantId,
      scheduledStart: { gte: todayStart, lte: todayEnd },
      status: { notIn: ["STORNIERT", "ABGESCHLOSSEN", "ABGERECHNET"] },
    },
    include: { appointments: true },
  });

  for (const o of todayOrders) {
    if (!o.appointments.length) {
      warnings.push({
        type: "no_staff",
        severity: "red",
        title: "Kein Mitarbeiter zugewiesen",
        detail: o.title ?? o.orderNumber,
        orderId: o.id,
      });
    }
    if (o.materialStatus === "MISSING") {
      warnings.push({
        type: "material_missing",
        severity: "red",
        title: "Material fehlt",
        detail: o.title ?? o.orderNumber,
        orderId: o.id,
      });
    } else if (o.materialStatus === "PARTLY_AVAILABLE" || o.materialStatus === "NOT_CHECKED") {
      warnings.push({
        type: "material_watch",
        severity: "yellow",
        title: "Material prüfen",
        detail: o.title ?? o.orderNumber,
        orderId: o.id,
      });
    }
  }

  const balances = await prisma.stockBalance.findMany({
    where: { article: { tenantId: auth.tenantId, isActive: true } },
    include: { article: true, storageLocation: true },
  });

  const articleTotals = new Map<string, { name: string; available: number; minimum: number; id: string }>();
  for (const b of balances) {
    const t = articleTotals.get(b.articleId) ?? {
      name: b.article.name,
      available: 0,
      minimum: b.article.minimumStock,
      id: b.articleId,
    };
    t.available += calcAvailableQuantity(b.onHandQuantity, b.reservedQuantity);
    articleTotals.set(b.articleId, t);
  }

  for (const t of articleTotals.values()) {
    if (t.available < t.minimum) {
      warnings.push({
        type: "low_stock",
        severity: t.available <= 0 ? "red" : "yellow",
        title: "Lagerwarnung",
        detail: `${t.name}: ${t.available} verfügbar (Min. ${t.minimum})`,
        articleId: t.id,
      });
    }
  }

  const overdue = await prisma.order.count({
    where: {
      tenantId: auth.tenantId,
      scheduledStart: { lt: todayStart },
      status: { in: ["NEUE_ANFRAGE", "TERMIN_GEBUCHT", "EINGEPLANT"] },
    },
  });

  if (overdue > 0) {
    warnings.push({
      type: "overdue",
      severity: "red",
      title: `${overdue} überfällige Aufträge`,
      detail: "Termin liegt in der Vergangenheit",
    });
  }

  return apiSuccess({
    warnings,
    counts: {
      red: warnings.filter((w) => w.severity === "red").length,
      yellow: warnings.filter((w) => w.severity === "yellow").length,
      total: warnings.length,
    },
  });
}
