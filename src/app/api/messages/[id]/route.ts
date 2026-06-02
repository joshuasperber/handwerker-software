import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

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

  const message = await prisma.message.update({
    where: { id },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
    },
    include: { sender: true, order: { select: { orderNumber: true } } },
  });

  return apiSuccess(message);
}
