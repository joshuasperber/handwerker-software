import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id, shareId } = await params;
  const share = await prisma.orderShare.findFirst({
    where: { id: shareId, orderId: id, tenantId: auth.tenantId },
  });
  if (!share) return apiError("Freigabe nicht gefunden", 404);

  await prisma.orderShare.delete({ where: { id: shareId } });
  return apiSuccess({ id: shareId });
}
