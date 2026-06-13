import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { hasPermission } from "@/lib/permissions";

const OFFICE_ROLES = ["ADMIN", "BUERO", "MEISTER"] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("messages.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.message.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Nachricht nicht gefunden", 404);

  if (body.status === "RESOLVED" && existing.category === "MATERIAL_REQUEST") {
    const canResolve =
      hasPermission(auth.role, "orders.write") || OFFICE_ROLES.includes(auth.role as (typeof OFFICE_ROLES)[number]);
    if (!canResolve) return apiError("Keine Berechtigung", 403);
  } else {
    const isOffice = OFFICE_ROLES.includes(auth.role as (typeof OFFICE_ROLES)[number]);
    const involved =
      existing.senderId === auth.id ||
      existing.recipientUserId === auth.id ||
      (isOffice && !existing.recipientUserId);
    if (!involved) return apiError("Keine Berechtigung", 403);
  }

  const message = await prisma.message.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
    include: { sender: true, order: { select: { orderNumber: true } } },
  });

  return apiSuccess(message);
}
