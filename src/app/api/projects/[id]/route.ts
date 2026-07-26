import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { getProjectOrNull, mapProjectListItem } from "@/lib/projects/overview";
import {
  parseOptionalDate,
  validateProjectInput,
  type ProjectInput,
} from "@/lib/projects/types";
import type { ProjectStatus } from "@/generated/prisma/client";

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  customerId: z.string().min(1).optional(),
  addressStreet: z.string().max(200).optional().nullable(),
  addressZip: z.string().max(20).optional().nullable(),
  addressCity: z.string().max(100).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z
    .enum(["GEPLANT", "AKTIV", "PAUSIERT", "ABGESCHLOSSEN", "ABGERECHNET", "STORNIERT"])
    .optional(),
  description: z.string().max(5000).optional().nullable(),
  notes: z.string().max(10000).optional().nullable(),
  teamId: z.string().optional().nullable(),
  employeeIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const project = await getProjectOrNull(auth.tenantId, id);
  if (!project) return apiError("Projekt nicht gefunden", 404);
  return apiSuccess(mapProjectListItem(project));
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.project.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, name: true, customerId: true },
  });
  if (!existing) return apiError("Projekt nicht gefunden", 404);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
  const validationError = validateProjectInput({
    name: data.name ?? existing.name,
    customerId: data.customerId ?? existing.customerId,
    startDate: data.startDate,
    endDate: data.endDate,
  } as ProjectInput);
  if (validationError) return apiError(validationError);

  if (data.customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: data.customerId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!customer) return apiError("Kunde nicht gefunden", 404);
  }

  if (data.teamId) {
    const team = await prisma.team.findFirst({
      where: { id: data.teamId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!team) return apiError("Team nicht gefunden", 404);
  }

  if (data.employeeIds) {
    const employeeIds = [...new Set(data.employeeIds)];
    const count = await prisma.employee.count({
      where: { tenantId: auth.tenantId, id: { in: employeeIds } },
    });
    if (count !== employeeIds.length) {
      return apiError("Ein oder mehrere Mitarbeiter wurden nicht gefunden", 404);
    }

    await prisma.$transaction([
      prisma.projectMember.deleteMany({ where: { projectId: id } }),
      ...(employeeIds.length
        ? [
            prisma.projectMember.createMany({
              data: employeeIds.map((employeeId) => ({ projectId: id, employeeId })),
            }),
          ]
        : []),
      prisma.project.update({
        where: { id },
        data: {
          ...(data.name != null ? { name: data.name.trim() } : {}),
          ...(data.customerId != null ? { customerId: data.customerId } : {}),
          ...(data.addressStreet !== undefined
            ? { addressStreet: data.addressStreet?.trim() || null }
            : {}),
          ...(data.addressZip !== undefined
            ? { addressZip: data.addressZip?.trim() || null }
            : {}),
          ...(data.addressCity !== undefined
            ? { addressCity: data.addressCity?.trim() || null }
            : {}),
          ...(data.startDate !== undefined
            ? { startDate: parseOptionalDate(data.startDate) }
            : {}),
          ...(data.endDate !== undefined ? { endDate: parseOptionalDate(data.endDate) } : {}),
          ...(data.status != null ? { status: data.status as ProjectStatus } : {}),
          ...(data.description !== undefined
            ? { description: data.description?.trim() || null }
            : {}),
          ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
          ...(data.teamId !== undefined ? { teamId: data.teamId || null } : {}),
        },
      }),
    ]);
  } else {
    await prisma.project.update({
      where: { id },
      data: {
        ...(data.name != null ? { name: data.name.trim() } : {}),
        ...(data.customerId != null ? { customerId: data.customerId } : {}),
        ...(data.addressStreet !== undefined
          ? { addressStreet: data.addressStreet?.trim() || null }
          : {}),
        ...(data.addressZip !== undefined
          ? { addressZip: data.addressZip?.trim() || null }
          : {}),
        ...(data.addressCity !== undefined
          ? { addressCity: data.addressCity?.trim() || null }
          : {}),
        ...(data.startDate !== undefined
          ? { startDate: parseOptionalDate(data.startDate) }
          : {}),
        ...(data.endDate !== undefined ? { endDate: parseOptionalDate(data.endDate) } : {}),
        ...(data.status != null ? { status: data.status as ProjectStatus } : {}),
        ...(data.description !== undefined
          ? { description: data.description?.trim() || null }
          : {}),
        ...(data.notes !== undefined ? { notes: data.notes?.trim() || null } : {}),
        ...(data.teamId !== undefined ? { teamId: data.teamId || null } : {}),
      },
    });
  }

  const full = await getProjectOrNull(auth.tenantId, id);
  return apiSuccess(full ? mapProjectListItem(full) : { id });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.project.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!existing) return apiError("Projekt nicht gefunden", 404);

  await prisma.order.updateMany({
    where: { projectId: id, tenantId: auth.tenantId },
    data: { projectId: null },
  });
  await prisma.project.delete({ where: { id } });
  return apiSuccess({ ok: true });
}
