import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { format, startOfDay, endOfDay } from "date-fns";
import { buildPickupList } from "@/lib/monteur/pickup-list";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const dateStr = searchParams.get("date") ?? format(new Date(), "yyyy-MM-dd");
  const date = new Date(dateStr);

  const employee = await prisma.employee.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
  });
  if (!employee) return apiSuccess({ byOrder: [], aggregated: [], appointments: [] });

  const appointments = await prisma.appointment.findMany({
    where: {
      tenantId: auth.tenantId,
      employeeId: employee.id,
      startTime: { gte: startOfDay(date), lte: endOfDay(date) },
      status: { not: "STORNIERT" },
    },
    include: {
      order: {
        include: {
          customer: true,
          materialLines: {
            include: {
              reservations: {
                where: { status: { in: ["VORGESCHLAGEN", "RESERVIERT"] } },
                include: { storageLocation: true },
              },
            },
          },
        },
      },
    },
    orderBy: { startTime: "asc" },
  });

  const orders = appointments.map((a) => a.order);
  const uniqueOrders = [...new Map(orders.map((o) => [o.id, o])).values()];

  const pickup = buildPickupList(
    uniqueOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customer: o.customer,
      materialLines: o.materialLines.map((l) => ({
        id: l.id,
        name: l.name,
        quantityRequired: l.quantityRequired,
        unit: l.unit,
        isTool: l.isTool,
        articleId: l.articleId,
        reservations: l.reservations.map((r) => ({
          status: r.status,
          quantity: r.quantity,
          storageLocation: r.storageLocation,
        })),
      })),
    }))
  );

  return apiSuccess({
    date: dateStr,
    appointments: appointments.map((a) => ({
      id: a.id,
      startTime: a.startTime,
      endTime: a.endTime,
      status: a.status,
      order: {
        id: a.order.id,
        orderNumber: a.order.orderNumber,
        customer: a.order.customer,
        materialStatus: a.order.materialStatus,
      },
    })),
    ...pickup,
  });
}
