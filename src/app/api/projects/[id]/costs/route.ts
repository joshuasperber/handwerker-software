import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { PROJECT_COST_SOURCE_LABELS } from "@/lib/projects/types";
import type { ProjectCostSource } from "@/generated/prisma/client";

const costSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().min(0).default(1),
  unit: z.string().max(40).optional().nullable(),
  netAmount: z.number().min(0),
  vatAmount: z.number().min(0).default(0),
  grossAmount: z.number().min(0).optional(),
  paidAmount: z.number().min(0).default(0),
  source: z
    .enum(["MANUAL", "INVENTORY", "EXPENSE", "ORDER_MATERIAL", "RECEIPT", "INVOICE", "ORDER"])
    .default("MANUAL"),
  isReimbursable: z.boolean().default(false),
  isBillable: z.boolean().default(true),
  orderId: z.string().optional().nullable(),
  articleId: z.string().optional().nullable(),
  expenseId: z.string().optional().nullable(),
});

function mapCost(c: {
  id: string;
  source: ProjectCostSource;
  description: string;
  quantity: number;
  unit: string | null;
  netAmount: number;
  vatAmount: number;
  grossAmount: number;
  paidAmount: number;
  isReimbursable: boolean;
  isBillable: boolean;
  orderId: string | null;
  articleId: string | null;
  expenseId: string | null;
  createdAt: Date;
  order?: { orderNumber: string } | null;
  article?: { name: string } | null;
}) {
  return {
    id: c.id,
    source: c.source,
    sourceLabel: PROJECT_COST_SOURCE_LABELS[c.source],
    description: c.description,
    quantity: c.quantity,
    unit: c.unit,
    netAmount: c.netAmount,
    vatAmount: c.vatAmount,
    grossAmount: c.grossAmount,
    paidAmount: c.paidAmount,
    openAmount: Math.max(0, c.grossAmount - c.paidAmount),
    isReimbursable: c.isReimbursable,
    isBillable: c.isBillable,
    orderId: c.orderId,
    orderNumber: c.order?.orderNumber ?? null,
    articleId: c.articleId,
    articleName: c.article?.name ?? null,
    expenseId: c.expenseId,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.read");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!project) return apiError("Projekt nicht gefunden", 404);

  const costs = await prisma.projectCost.findMany({
    where: { projectId },
    include: {
      order: { select: { orderNumber: true } },
      article: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return apiSuccess(costs.map(mapCost));
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("orders.write");
  if (auth instanceof Response) return auth;

  const { id: projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, tenantId: auth.tenantId },
    select: { id: true },
  });
  if (!project) return apiError("Projekt nicht gefunden", 404);

  const body = await request.json().catch(() => null);
  const parsed = costSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
  const grossAmount =
    data.grossAmount != null
      ? data.grossAmount
      : Math.round((data.netAmount + data.vatAmount) * 100) / 100;

  if (data.orderId) {
    const order = await prisma.order.findFirst({
      where: { id: data.orderId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!order) return apiError("Auftrag nicht gefunden", 404);
  }

  if (data.articleId) {
    const article = await prisma.article.findFirst({
      where: { id: data.articleId, tenantId: auth.tenantId },
      select: { id: true },
    });
    if (!article) return apiError("Artikel nicht gefunden", 404);
  }

  const cost = await prisma.projectCost.create({
    data: {
      projectId,
      description: data.description.trim(),
      quantity: data.quantity,
      unit: data.unit?.trim() || null,
      netAmount: data.netAmount,
      vatAmount: data.vatAmount,
      grossAmount,
      paidAmount: data.paidAmount,
      source: data.source,
      isReimbursable: data.isReimbursable,
      isBillable: data.isBillable,
      orderId: data.orderId || null,
      articleId: data.articleId || null,
      expenseId: data.expenseId || null,
      createdById: auth.id,
    },
    include: {
      order: { select: { orderNumber: true } },
      article: { select: { name: true } },
    },
  });

  return apiSuccess(mapCost(cost), 201);
}
