import { NextRequest } from "next/server";
import { requireAuth, apiSuccess } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { toggleChecklistSchema } from "@/lib/schemas/orders";
import { requireMonteurOrder } from "@/lib/monteur-access";
import { toggleOrderChecklistItem } from "@/lib/orders/checklist";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id: orderId } = await params;
  const access = await requireMonteurOrder(auth, orderId);
  if ("error" in access && access.error) return access.error;

  const body = await parseBody(request, toggleChecklistSchema);
  if (body instanceof Response) return body;

  const updated = await toggleOrderChecklistItem({
    tenantId: auth.tenantId,
    orderId,
    checklistId: body.checklistId,
    isChecked: body.isChecked,
    userId: auth.id,
  });

  if (updated instanceof Response) return updated;
  return apiSuccess(updated);
}
