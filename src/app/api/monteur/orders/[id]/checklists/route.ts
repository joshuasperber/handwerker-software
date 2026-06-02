import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const body = await request.json();
  const { checklistId, isChecked } = body;

  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  const item = await prisma.orderChecklist.findFirst({
    where: { id: checklistId, orderId },
  });
  if (!item) return apiError("Checklistenpunkt nicht gefunden", 404);

  const updated = await prisma.orderChecklist.update({
    where: { id: checklistId },
    data: {
      isChecked,
      checkedAt: isChecked ? new Date() : null,
      checkedBy: isChecked ? auth.id : null,
    },
  });

  return apiSuccess(updated);
}
