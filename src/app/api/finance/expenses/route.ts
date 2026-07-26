import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { expenseInputSchema } from "@/lib/finance/schemas";
import { toExpenseDTO } from "@/lib/finance/overview";
import type { ExpenseCategory, Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  const where: Prisma.ExpenseWhereInput = { tenantId: auth.tenantId };

  if (from || to) {
    where.expenseDate = {};
    if (from) where.expenseDate.gte = new Date(from);
    if (to) where.expenseDate.lte = new Date(to);
  }
  if (category) where.category = category as ExpenseCategory;

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: "desc" },
  });

  return apiSuccess(expenses.map(toExpenseDTO));
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleMultipartCreate(request, auth.tenantId, auth.id);
  }

  const body = await request.json();
  const parsed = expenseInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      tenantId: auth.tenantId,
      category: data.category,
      description: data.description,
      netAmount: data.netAmount,
      vatAmount: data.vatAmount,
      grossAmount: data.grossAmount,
      expenseDate: new Date(data.expenseDate),
      paymentStatus: data.paymentStatus,
      supplier: data.supplier ?? null,
      orderId: data.orderId ?? null,
      customerId: data.customerId ?? null,
      internalNote: data.internalNote ?? null,
      isInvestment: data.isInvestment,
      createdById: auth.id,
    },
  });

  return apiSuccess(toExpenseDTO(expense), 201);
}

async function handleMultipartCreate(
  request: NextRequest,
  tenantId: string,
  userId: string
) {
  const { uploadFile, isStorageConfigured } = await import("@/lib/storage");
  const { validateUpload } = await import("@/lib/files");

  const formData = await request.formData();
  const rawData = formData.get("data");
  if (typeof rawData !== "string") {
    return apiError("Formulardaten fehlen");
  }

  let json: unknown;
  try {
    json = JSON.parse(rawData);
  } catch {
    return apiError("Ungültige Formulardaten");
  }

  const parsed = expenseInputSchema.safeParse(json);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const file = formData.get("receipt");
  let receiptFields: {
    receiptFileName?: string;
    receiptMimeType?: string;
    receiptStorageKey?: string;
    receiptSizeBytes?: number;
  } = {};

  if (file instanceof File && file.size > 0) {
    const validation = validateUpload(file.type, file.size);
    if (!validation.ok) return apiError(validation.error);

    if (!isStorageConfigured()) {
      return apiError("Datei-Speicher nicht konfiguriert", 503);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await uploadFile(buffer, file.name, file.type, "expense-receipts");
    receiptFields = {
      receiptFileName: file.name,
      receiptMimeType: file.type,
      receiptStorageKey: uploaded.key,
      receiptSizeBytes: file.size,
    };
  }

  const data = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      tenantId,
      category: data.category,
      description: data.description,
      netAmount: data.netAmount,
      vatAmount: data.vatAmount,
      grossAmount: data.grossAmount,
      expenseDate: new Date(data.expenseDate),
      paymentStatus: data.paymentStatus,
      supplier: data.supplier ?? null,
      orderId: data.orderId ?? null,
      customerId: data.customerId ?? null,
      internalNote: data.internalNote ?? null,
      isInvestment: data.isInvestment,
      createdById: userId,
      ...receiptFields,
    },
  });

  return apiSuccess(toExpenseDTO(expense), 201);
}
