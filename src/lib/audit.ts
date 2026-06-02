import { prisma } from "./prisma";
import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "./auth";

interface AuditParams {
  tenantId: string;
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export async function createAuditLog(params: AuditParams) {
  return prisma.auditLog.create({
    data: {
      tenantId: params.tenantId,
      userId: params.userId ?? undefined,
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      oldValues: (params.oldValues ?? undefined) as Prisma.InputJsonValue | undefined,
      newValues: (params.newValues ?? undefined) as Prisma.InputJsonValue | undefined,
      ipAddress: params.ipAddress ?? undefined,
    },
  });
}

export async function auditOrderStatusChange(
  user: SessionUser,
  orderId: string,
  oldStatus: string,
  newStatus: string,
  ipAddress?: string
) {
  return createAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    entityType: "Order",
    entityId: orderId,
    action: "STATUS_CHANGE",
    oldValues: { status: oldStatus },
    newValues: { status: newStatus },
    ipAddress,
  });
}

export async function auditEntityChange(
  user: SessionUser,
  entityType: string,
  entityId: string,
  action: string,
  oldValues?: Record<string, unknown> | null,
  newValues?: Record<string, unknown> | null,
  ipAddress?: string
) {
  return createAuditLog({
    tenantId: user.tenantId,
    userId: user.id,
    entityType,
    entityId,
    action,
    oldValues,
    newValues,
    ipAddress,
  });
}
