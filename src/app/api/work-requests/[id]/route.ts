import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import type { WorkRequestStatus } from "@/generated/prisma/client";
import { generateOrderNumber } from "@/lib/utils";
import { createAuditLog } from "@/lib/audit";
import { standardPhaseCreateData } from "@/lib/orders/phases";

const REVIEW_STATUSES: WorkRequestStatus[] = [
  "ACCEPTED",
  "REJECTED",
  "ARCHIVED",
  "CONVERTED",
];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const item = await prisma.workRequest.findFirst({
    where: { id, tenantId: auth.tenantId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      customer: true,
      order: { select: { id: true, orderNumber: true, description: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  if (!item) return apiError("Anfrage nicht gefunden", 404);

  const canManage = await import("@/lib/permissions").then((m) =>
    m.hasPermission(auth.role, "work_requests.manage")
  );
  if (!canManage && item.createdById !== auth.id) {
    return apiError("Keine Berechtigung", 403);
  }

  return apiSuccess(item);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("work_requests.manage");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const body = await request.json();
  const { status, reviewNote, convertToOrder } = body as {
    status?: WorkRequestStatus;
    reviewNote?: string;
    convertToOrder?: boolean;
  };

  const item = await prisma.workRequest.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!item) return apiError("Anfrage nicht gefunden", 404);

  if (convertToOrder || status === "CONVERTED") {
    if (!item.customerId) {
      return apiError("Zum Umwandeln muss ein Kunde verknüpft sein", 400);
    }

    const customer = await prisma.customer.findFirst({
      where: { id: item.customerId, tenantId: auth.tenantId },
      include: { properties: { take: 1, orderBy: { createdAt: "asc" } } },
    });
    if (!customer) return apiError("Kunde nicht gefunden", 404);

    let propertyId = customer.properties[0]?.id;
    if (!propertyId) {
      const prop = await prisma.property.create({
        data: {
          tenantId: auth.tenantId,
          customerId: customer.id,
          label: "Hauptadresse",
          street: item.addressNote || "Adresse folgt",
          zipCode: "00000",
          city: "Unbekannt",
        },
      });
      propertyId = prop.id;
    }

    const order = await prisma.order.create({
      data: {
        tenantId: auth.tenantId,
        customerId: customer.id,
        propertyId,
        orderNumber: generateOrderNumber(),
        title: item.title,
        status: "NEUE_ANFRAGE",
        description: item.description,
        internalNotes: [
          `Aus Arbeitsmeldung ${item.id}`,
          item.materialNotes ? `Material: ${item.materialNotes}` : null,
          item.estimatedHours != null ? `Geschätzter Aufwand: ${item.estimatedHours} h` : null,
          reviewNote ? `Prüfung: ${reviewNote}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        priority: item.urgency,
        phases: { create: standardPhaseCreateData() },
      },
    });

    const updated = await prisma.workRequest.update({
      where: { id },
      data: {
        status: "CONVERTED",
        reviewedById: auth.id,
        reviewedAt: new Date(),
        reviewNote: reviewNote?.trim() || null,
        convertedOrderId: order.id,
        orderId: item.orderId ?? order.id,
      },
      include: {
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        customer: { select: { id: true, firstName: true, lastName: true, company: true } },
        order: { select: { id: true, orderNumber: true, description: true } },
      },
    });

    await createAuditLog({
      tenantId: auth.tenantId,
      userId: auth.id,
      entityType: "WorkRequest",
      entityId: id,
      action: "CONVERT_TO_ORDER",
      newValues: { orderId: order.id, orderNumber: order.orderNumber },
    });

    return apiSuccess({ ...updated, convertedOrder: order });
  }

  if (!status || !REVIEW_STATUSES.includes(status)) {
    return apiError("Ungültiger Status", 400);
  }

  const updated = await prisma.workRequest.update({
    where: { id },
    data: {
      status,
      reviewedById: auth.id,
      reviewedAt: new Date(),
      reviewNote: reviewNote?.trim() || null,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      customer: { select: { id: true, firstName: true, lastName: true, company: true } },
      order: { select: { id: true, orderNumber: true, description: true } },
    },
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "WorkRequest",
    entityId: id,
    action: "WORK_REQUEST_REVIEW",
    oldValues: { status: item.status },
    newValues: { status, reviewNote },
  });

  return apiSuccess(updated);
}
