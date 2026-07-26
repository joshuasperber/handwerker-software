import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

const noteSchema = z.object({
  body: z.string().min(1).max(10000),
  orderId: z.string().optional().nullable(),
});

async function assertProject(tenantId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, tenantId },
    select: { id: true },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  if (!(await assertProject(auth.tenantId, projectId))) {
    return apiError("Projekt nicht gefunden", 404);
  }

  const notes = await prisma.projectNote.findMany({
    where: { projectId },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      order: { select: { id: true, orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(
    notes.map((n) => ({
      id: n.id,
      body: n.body,
      orderId: n.orderId,
      orderNumber: n.order?.orderNumber ?? null,
      createdAt: n.createdAt.toISOString(),
      createdBy: n.createdBy
        ? `${n.createdBy.firstName} ${n.createdBy.lastName}`.trim()
        : null,
    }))
  );
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  if (!(await assertProject(auth.tenantId, projectId))) {
    return apiError("Projekt nicht gefunden", 404);
  }

  const body = await request.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) return apiError("Notiztext erforderlich");

  if (parsed.data.orderId) {
    const order = await prisma.order.findFirst({
      where: {
        id: parsed.data.orderId,
        tenantId: auth.tenantId,
        OR: [{ projectId }, { projectId: null }],
      },
      select: { id: true },
    });
    if (!order) return apiError("Auftrag nicht gefunden", 404);
  }

  const note = await prisma.projectNote.create({
    data: {
      projectId,
      body: parsed.data.body.trim(),
      orderId: parsed.data.orderId || null,
      createdById: auth.id,
    },
    include: {
      createdBy: { select: { firstName: true, lastName: true } },
      order: { select: { id: true, orderNumber: true } },
    },
  });

  return apiSuccess(
    {
      id: note.id,
      body: note.body,
      orderId: note.orderId,
      orderNumber: note.order?.orderNumber ?? null,
      createdAt: note.createdAt.toISOString(),
      createdBy: note.createdBy
        ? `${note.createdBy.firstName} ${note.createdBy.lastName}`.trim()
        : null,
    },
    201
  );
}
