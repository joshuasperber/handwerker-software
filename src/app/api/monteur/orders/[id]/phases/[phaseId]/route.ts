import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { requireMonteurOrder } from "@/lib/monteur-access";

const PHASE_INCLUDE = {
  assignedTeam: { select: { id: true, name: true } },
  assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
  files: { orderBy: { createdAt: "desc" as const } },
};

/** Monteur darf Phasen-Status und Notizen auf eigenen Aufträgen ändern. */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; phaseId: string }> }
) {
  const auth = await requireAuth("monteur.own");
  if (auth instanceof Response) return auth;

  const { id, phaseId } = await params;
  const access = await requireMonteurOrder(auth, id);
  if ("error" in access && access.error) return access.error;

  const body = await request.json();

  const phase = await prisma.orderPhase.findFirst({
    where: { id: phaseId, orderId: id },
  });
  if (!phase) return apiError("Phase nicht gefunden", 404);

  const updated = await prisma.orderPhase.update({
    where: { id: phaseId },
    data: {
      ...(body.status !== undefined ? { status: body.status } : {}),
      ...(body.notes !== undefined ? { notes: body.notes || null } : {}),
      ...(body.specialNotes !== undefined ? { specialNotes: body.specialNotes || null } : {}),
    },
    include: PHASE_INCLUDE,
  });

  return apiSuccess(updated);
}
