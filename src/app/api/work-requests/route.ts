import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import type { WorkRequestStatus, WorkRequestType } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/permissions";

const TYPES: WorkRequestType[] = [
  "ZUSATZARBEIT",
  "NEUE_ANFRAGE",
  "MATERIAL_FEHLT",
  "SCHADEN",
  "RUECKFRAGE",
  "SONSTIGES",
];

export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const canManage = hasPermission(auth.role, "work_requests.manage");
  const canCreate = hasPermission(auth.role, "work_requests.create");
  if (!canManage && !canCreate) {
    return apiError("Keine Berechtigung", 403);
  }

  const status = request.nextUrl.searchParams.get("status");
  const mine = request.nextUrl.searchParams.get("mine") === "1";

  const requests = await prisma.workRequest.findMany({
    where: {
      tenantId: auth.tenantId,
      ...(canManage && !mine ? {} : { createdById: auth.id }),
      ...(status ? { status: status as WorkRequestStatus } : {}),
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      customer: { select: { id: true, firstName: true, lastName: true, company: true } },
      order: { select: { id: true, orderNumber: true, description: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return apiSuccess(requests);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("work_requests.create");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const {
    title,
    description,
    type = "ZUSATZARBEIT",
    urgency = "NORMAL",
    estimatedHours,
    materialNotes,
    addressNote,
    orderId,
    customerId,
    asDraft,
  } = body;

  if (!title?.trim() || !description?.trim()) {
    return apiError("Titel und Beschreibung sind Pflicht", 400);
  }
  if (!TYPES.includes(type)) return apiError("Ungültiger Typ", 400);

  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!order) return apiError("Auftrag nicht gefunden", 404);
  }
  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!customer) return apiError("Kunde nicht gefunden", 404);
  }

  const created = await prisma.workRequest.create({
    data: {
      tenantId: auth.tenantId,
      title: String(title).trim(),
      description: String(description).trim(),
      type,
      urgency,
      estimatedHours:
        estimatedHours === undefined || estimatedHours === null || estimatedHours === ""
          ? null
          : Number(estimatedHours),
      materialNotes: materialNotes?.trim() || null,
      addressNote: addressNote?.trim() || null,
      orderId: orderId || null,
      customerId: customerId || null,
      createdById: auth.id,
      status: asDraft ? "DRAFT" : "SUBMITTED",
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  return apiSuccess(created, 201);
}
