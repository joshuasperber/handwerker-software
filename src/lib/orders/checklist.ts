import { prisma } from "@/lib/prisma";
import { apiError } from "@/lib/api";

interface ToggleChecklistInput {
  tenantId: string;
  orderId: string;
  checklistId: string;
  isChecked: boolean;
  userId: string;
}

export async function toggleOrderChecklistItem(input: ToggleChecklistInput) {
  const item = await prisma.orderChecklist.findFirst({
    where: {
      id: input.checklistId,
      orderId: input.orderId,
      order: { tenantId: input.tenantId },
    },
  });

  if (!item) {
    return apiError("Checklistenpunkt nicht gefunden", 404);
  }

  return prisma.orderChecklist.update({
    where: { id: input.checklistId },
    data: {
      isChecked: input.isChecked,
      checkedAt: input.isChecked ? new Date() : null,
      checkedBy: input.isChecked ? input.userId : null,
    },
  });
}

/** Checklisten mit leerem Label zählen nicht als Pflichtpunkt. */
export function areOrderChecklistsComplete(
  checklists: { label: string | null; isChecked: boolean }[]
) {
  const required = checklists.filter((c) => c.label?.trim());
  return required.length === 0 || required.every((c) => c.isChecked);
}
