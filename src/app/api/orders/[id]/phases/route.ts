import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { ensureOrderPhases } from "@/lib/orders/phases";

const PHASE_INCLUDE = {
  assignedTeam: { select: { id: true, name: true } },
  assignedEmployee: { include: { user: { select: { firstName: true, lastName: true } } } },
  files: { orderBy: { createdAt: "desc" as const } },
};

async function assertOrder(orderId: string, tenantId: string) {
  return prisma.order.findFirst({ where: { id: orderId, tenantId } });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (!(await assertOrder(id, auth.tenantId))) return apiError("Auftrag nicht gefunden", 404);

  await ensureOrderPhases(id);
  const phases = await prisma.orderPhase.findMany({
    where: { orderId: id },
    orderBy: { sortOrder: "asc" },
    include: PHASE_INCLUDE,
  });
  return apiSuccess(phases);
}

/** Neue (auch eigene) Phase am Ende des Ablaufs anlegen. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (!(await assertOrder(id, auth.tenantId))) return apiError("Auftrag nicht gefunden", 404);

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return apiError("Name der Phase fehlt", 400);

  const last = await prisma.orderPhase.findFirst({
    where: { orderId: id },
    orderBy: { sortOrder: "desc" },
    select: { sortOrder: true },
  });

  const phase = await prisma.orderPhase.create({
    data: {
      orderId: id,
      name,
      phaseType: body.phaseType ?? "SONSTIGES",
      status: "AUSSTEHEND",
      isEnabled: true,
      sortOrder: (last?.sortOrder ?? -1) + 1,
    },
    include: PHASE_INCLUDE,
  });

  return apiSuccess(phase, 201);
}

/**
 * Sammeloperationen für Phasen:
 *  - `{ order: [phaseId, ...] }` setzt die Reihenfolge neu.
 *  - `{ action: "resetDefaults" }` legt fehlende Standardphasen wieder an.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  if (!(await assertOrder(id, auth.tenantId))) return apiError("Auftrag nicht gefunden", 404);

  const body = await request.json().catch(() => ({}));

  if (Array.isArray(body.order)) {
    const ids: string[] = body.order;
    const existing = await prisma.orderPhase.findMany({
      where: { orderId: id, id: { in: ids } },
      select: { id: true },
    });
    const validIds = new Set(existing.map((p) => p.id));
    await prisma.$transaction(
      ids
        .filter((phaseId) => validIds.has(phaseId))
        .map((phaseId, index) =>
          prisma.orderPhase.update({ where: { id: phaseId }, data: { sortOrder: index } })
        )
    );
  } else if (body.action === "resetDefaults") {
    await ensureOrderPhases(id);
  } else {
    return apiError("Ungültige Anfrage", 400);
  }

  const phases = await prisma.orderPhase.findMany({
    where: { orderId: id },
    orderBy: { sortOrder: "asc" },
    include: PHASE_INCLUDE,
  });
  return apiSuccess(phases);
}
