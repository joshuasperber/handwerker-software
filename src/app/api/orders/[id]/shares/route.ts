import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { notifyOrderShared } from "@/lib/notifications";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const order = await prisma.order.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const shares = await prisma.orderShare.findMany({
    where: { orderId: id, tenantId: auth.tenantId },
    include: {
      sharedWith: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      sharedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(shares);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const userId = (body.userId ?? "").trim();
  const note = (body.note ?? "").trim() || null;

  if (!userId) return apiError("Bitte eine Person auswählen", 400);

  const order = await prisma.order.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, orderNumber: true },
  });
  if (!order) return apiError("Auftrag nicht gefunden", 404);

  const targetUser = await prisma.user.findFirst({
    where: { id: userId, tenantId: auth.tenantId, isActive: true },
    select: { id: true, email: true, firstName: true, lastName: true },
  });
  if (!targetUser) return apiError("Person nicht gefunden", 404);

  const existing = await prisma.orderShare.findUnique({
    where: { orderId_sharedWithUserId: { orderId: id, sharedWithUserId: userId } },
  });
  if (existing) return apiError("Bereits mit dieser Person geteilt", 409);

  const share = await prisma.orderShare.create({
    data: {
      tenantId: auth.tenantId,
      orderId: id,
      sharedWithUserId: userId,
      sharedById: auth.id,
      note,
    },
    include: {
      sharedWith: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
      sharedBy: { select: { firstName: true, lastName: true } },
    },
  });

  // Begleitnachricht im Postfach des Empfängers anlegen.
  await prisma.message.create({
    data: {
      tenantId: auth.tenantId,
      orderId: id,
      senderId: auth.id,
      recipientUserId: userId,
      subject: `Anfrage ${order.orderNumber} geteilt`,
      body: note
        ? `Die Anfrage ${order.orderNumber} wurde mit Ihnen geteilt.\n\n${note}`
        : `Die Anfrage ${order.orderNumber} wurde mit Ihnen geteilt.`,
      category: "SHARE",
      status: "SENT",
      isInternal: false,
    },
  });

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.tenantId },
    select: { name: true },
  });
  await notifyOrderShared(
    auth.tenantId,
    targetUser.email,
    tenant?.name ?? "Handwerker App",
    order.orderNumber,
    note
  );

  return apiSuccess(share, 201);
}
