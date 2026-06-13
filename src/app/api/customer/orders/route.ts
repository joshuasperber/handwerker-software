import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";

/** Aufträge des eingeloggten Kunden (Rolle KUNDE). */
export async function GET() {
  const auth = await requireAuth("customer.own");
  if (auth instanceof Response) return auth;

  const customer = await prisma.customer.findFirst({
    where: { userId: auth.id, tenantId: auth.tenantId },
    select: { id: true },
  });

  if (!customer) return apiSuccess([]);

  const orders = await prisma.order.findMany({
    where: { tenantId: auth.tenantId, customerId: customer.id },
    select: {
      id: true,
      orderNumber: true,
      title: true,
      status: true,
      description: true,
      scheduledStart: true,
      createdAt: true,
      property: { select: { street: true, city: true } },
      services: { include: { service: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return apiSuccess(orders);
}
