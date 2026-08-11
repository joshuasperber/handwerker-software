import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { expenseInputSchema } from "@/lib/finance/schemas";
import { toExpenseDTO } from "@/lib/finance/overview";
import { parseLocalDateInput } from "@/lib/finance/period";
import {
  mapExpensePrismaError,
  parseExpenseDate,
  resolveExpenseRelations,
} from "@/lib/finance/expense-persist";
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
    if (from) where.expenseDate.gte = parseLocalDateInput(from);
    if (to) {
      const toDate = parseLocalDateInput(to);
      where.expenseDate.lte = new Date(
        toDate.getFullYear(),
        toDate.getMonth(),
        toDate.getDate(),
        23,
        59,
        59,
        999
      );
    }
  }
  if (category) where.category = category as ExpenseCategory;

  try {
    const expenses = await prisma.expense.findMany({
      where,
      orderBy: { expenseDate: "desc" },
    });
    return apiSuccess(expenses.map(toExpenseDTO), 200, NO_STORE_HEADERS);
  } catch (err) {
    console.error("[finance/expenses GET]", err);
    return apiError(mapExpensePrismaError(err), 500);
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    return handleMultipartCreate(request, auth.tenantId, auth.id);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Ungültige JSON-Daten");
  }

  const parsed = expenseInputSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
  try {
    const refs = await resolveExpenseRelations(auth.tenantId, data);
    const expense = await prisma.expense.create({
      data: {
        tenantId: auth.tenantId,
        category: data.category,
        description: data.description,
        netAmount: data.netAmount,
        vatAmount: data.vatAmount,
        grossAmount: data.grossAmount,
        expenseDate: parseExpenseDate(data.expenseDate),
        paymentStatus: data.paymentStatus,
        supplier: data.supplier?.trim() || null,
        orderId: refs.orderId,
        customerId: refs.customerId,
        projectId: refs.projectId,
        internalNote: data.internalNote?.trim() || null,
        isInvestment: data.isInvestment,
        createdById: auth.id,
      },
    });
    return apiSuccess(toExpenseDTO(expense), 201, NO_STORE_HEADERS);
  } catch (err) {
    console.error("[finance/expenses POST]", err);
    return apiError(mapExpensePrismaError(err), 500);
  }
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
  let receiptWarning: string | null = null;

  if (file instanceof File && file.size > 0) {
    const validation = validateUpload(file.type, file.size);
    if (!validation.ok) return apiError(validation.error);

    if (!isStorageConfigured()) {
      receiptWarning =
        "Ausgabe gespeichert, aber Beleg konnte nicht hochgeladen werden (Datei-Speicher nicht konfiguriert).";
    } else {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const uploaded = await uploadFile(buffer, file.name, file.type, "expense-receipts");
        receiptFields = {
          receiptFileName: file.name,
          receiptMimeType: file.type,
          receiptStorageKey: uploaded.key,
          receiptSizeBytes: file.size,
        };
      } catch (err) {
        console.error("[finance/expenses] receipt upload failed", err);
        receiptWarning =
          "Ausgabe gespeichert, aber Beleg-Upload ist fehlgeschlagen. Bitte Beleg später erneut hochladen.";
      }
    }
  }

  const data = parsed.data;
  try {
    const refs = await resolveExpenseRelations(tenantId, data);
    const expense = await prisma.expense.create({
      data: {
        tenantId,
        category: data.category,
        description: data.description,
        netAmount: data.netAmount,
        vatAmount: data.vatAmount,
        grossAmount: data.grossAmount,
        expenseDate: parseExpenseDate(data.expenseDate),
        paymentStatus: data.paymentStatus,
        supplier: data.supplier?.trim() || null,
        orderId: refs.orderId,
        customerId: refs.customerId,
        projectId: refs.projectId,
        internalNote: data.internalNote?.trim() || null,
        isInvestment: data.isInvestment,
        createdById: userId,
        ...receiptFields,
      },
    });

    const dto = toExpenseDTO(expense);
    if (receiptWarning) {
      return apiSuccess({ ...dto, receiptWarning }, 201, NO_STORE_HEADERS);
    }
    return apiSuccess(dto, 201, NO_STORE_HEADERS);
  } catch (err) {
    console.error("[finance/expenses multipart POST]", err);
    return apiError(mapExpensePrismaError(err), 500);
  }
}
