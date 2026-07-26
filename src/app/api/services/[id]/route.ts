import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getServiceUsage } from "@/lib/services/usage-db";
import { describeServiceUsageBlock } from "@/lib/services/usage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("services.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const service = await prisma.service.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      questions: { orderBy: { sortOrder: "asc" } },
      qualifications: true,
      _count: {
        select: {
          orderServices: true,
          checklistTemplates: true,
          materialTemplates: true,
        },
      },
    },
  });
  if (!service) return apiError("Leistung nicht gefunden", 404);

  const usage = await getServiceUsage(id);
  return apiSuccess({ ...service, usage });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();

  const existing = await prisma.service.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!existing) return apiError("Leistung nicht gefunden", 404);

  const service = await prisma.service.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.description !== undefined ? { description: body.description } : {}),
      ...(body.durationMinutes !== undefined ? { durationMinutes: Number(body.durationMinutes) } : {}),
      ...(body.bufferMinutes !== undefined ? { bufferMinutes: Number(body.bufferMinutes) } : {}),
      ...(body.priceCents !== undefined ? { priceCents: body.priceCents ? Number(body.priceCents) : null } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      ...(body.sortOrder !== undefined ? { sortOrder: Number(body.sortOrder) } : {}),
    },
  });

  return apiSuccess(service);
}

/**
 * Löscht eine unbenutzte Leistung endgültig.
 * Bei bestehenden Verknüpfungen (Aufträge, Checklisten, Materialzeilen) wird
 * nur deaktiviert – Historie bleibt erhalten.
 *
 * Optional: `?mode=deactivate` erzwingt Deaktivieren ohne Hard-Delete.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("services.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const mode = new URL(request.url).searchParams.get("mode");

  const existing = await prisma.service.findFirst({ where: { id, tenantId: auth.tenantId } });
  if (!existing) return apiError("Leistung nicht gefunden", 404);

  const usage = await getServiceUsage(id);
  const forceDeactivate = mode === "deactivate";

  if (forceDeactivate || usage.inUse) {
    if (!existing.isActive && usage.inUse) {
      return apiSuccess({
        action: "already_inactive" as const,
        message:
          "Die Leistung ist bereits deaktiviert und bleibt wegen bestehender Verknüpfungen erhalten.",
        usage,
      });
    }

    const service = await prisma.service.update({
      where: { id },
      data: { isActive: false },
    });

    const message = usage.inUse
      ? describeServiceUsageBlock(usage)
      : "Leistung wurde deaktiviert und erscheint nicht mehr in neuen Aufträgen.";

    return apiSuccess({
      action: "deactivated" as const,
      message,
      usage,
      service,
    });
  }

  // Unbenutzt → vollständig löschen (Fragen, Qualifikationen, Materialvorlagen cascaden)
  await prisma.service.delete({ where: { id } });

  return apiSuccess({
    action: "deleted" as const,
    message: "Leistung wurde endgültig gelöscht.",
    usage,
  });
}
