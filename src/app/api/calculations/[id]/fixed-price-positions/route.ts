import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { createAuditLog } from "@/lib/audit";
import { z } from "zod";

const lineSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.coerce.number().positive().default(1),
  unitPriceNet: z.coerce.number().min(0).nullable().optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const calc = await prisma.calculation.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!calc) return apiError("Kalkulation nicht gefunden", 404);
  const lines = await prisma.fixedPricePosition.findMany({
    where: { calculationId: id },
    orderBy: { sortOrder: "asc" },
  });
  return apiSuccess(lines);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;
  const { id } = await params;
  const calc = await prisma.calculation.findFirst({
    where: { id, tenantId: auth.tenantId },
    select: { id: true, fixedPriceNet: true, useFixedPrice: true },
  });
  if (!calc) return apiError("Kalkulation nicht gefunden", 404);

  const body = await request.json().catch(() => null);
  const parsed = z.object({ lines: z.array(lineSchema).max(40) }).safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Ungültige Positionen");

  const lines = await prisma.$transaction(async (tx) => {
    await tx.fixedPricePosition.deleteMany({ where: { calculationId: id } });
    if (parsed.data.lines.length === 0) return [];
    await tx.fixedPricePosition.createMany({
      data: parsed.data.lines.map((line, index) => ({
        calculationId: id,
        description: line.description.trim(),
        quantity: line.quantity,
        unitPriceNet: line.unitPriceNet ?? null,
        sortOrder: index,
      })),
    });
    return tx.fixedPricePosition.findMany({
      where: { calculationId: id },
      orderBy: { sortOrder: "asc" },
    });
  });

  await createAuditLog({
    tenantId: auth.tenantId,
    userId: auth.id,
    entityType: "Calculation",
    entityId: id,
    action: "FIXED_PRICE_POSITIONS",
    newValues: {
      count: lines.length,
      fixedPriceNet: calc.fixedPriceNet,
      useFixedPrice: calc.useFixedPrice,
    },
  });

  return apiSuccess(lines);
}
