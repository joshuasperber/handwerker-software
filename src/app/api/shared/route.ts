import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess } from "@/lib/api";
import { orderServiceLabel } from "@/lib/utils";

/** Aufträge/Anfragen, die ausdrücklich mit der angemeldeten Person geteilt wurden. */
export async function GET() {
  const auth = await requireAuth("shared.read");
  if (auth instanceof Response) return auth;

  const shares = await prisma.orderShare.findMany({
    where: { tenantId: auth.tenantId, sharedWithUserId: auth.id },
    orderBy: { createdAt: "desc" },
    include: {
      sharedBy: { select: { firstName: true, lastName: true } },
      order: {
        select: {
          id: true,
          orderNumber: true,
          title: true,
          status: true,
          description: true,
          createdAt: true,
          customer: { select: { firstName: true, lastName: true } },
          property: { select: { zipCode: true, city: true } },
          services: { select: { service: { select: { name: true } }, customName: true } },
        },
      },
    },
  });

  const items = shares.map((s) => ({
    shareId: s.id,
    note: s.note,
    sharedAt: s.createdAt,
    sharedBy: s.sharedBy ? `${s.sharedBy.firstName} ${s.sharedBy.lastName}` : null,
    order: {
      id: s.order.id,
      orderNumber: s.order.orderNumber,
      title: s.order.title,
      status: s.order.status,
      description: s.order.description,
      createdAt: s.order.createdAt,
      customer: `${s.order.customer.firstName} ${s.order.customer.lastName}`,
      location: `${s.order.property.zipCode} ${s.order.property.city}`,
      services: s.order.services.map((sv) => orderServiceLabel(sv)),
    },
  }));

  return apiSuccess(items);
}
