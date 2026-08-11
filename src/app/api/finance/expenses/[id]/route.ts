import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { expensePatchSchema } from "@/lib/finance/schemas";
import { toExpenseDTO } from "@/lib/finance/overview";
import {
  mapExpensePrismaError,
  parseExpenseDate,
  resolveExpenseRelations,
} from "@/lib/finance/expense-persist";
import { deleteFile } from "@/lib/storage";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!expense) return apiError("Ausgabe nicht gefunden", 404);

  return apiSuccess(toExpenseDTO(expense), 200, NO_STORE_HEADERS);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.expense.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Ausgabe nicht gefunden", 404);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Ungültige JSON-Daten");
  }

  const parsed = expensePatchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
  try {
    const refs =
      data.orderId !== undefined ||
      data.projectId !== undefined ||
      data.customerId !== undefined
        ? await resolveExpenseRelations(auth.tenantId, {
            orderId: data.orderId !== undefined ? data.orderId : existing.orderId,
            projectId: data.projectId !== undefined ? data.projectId : existing.projectId,
            customerId:
              data.customerId !== undefined ? data.customerId : existing.customerId,
          })
        : null;

    const expense = await prisma.expense.update({
      where: { id },
      data: {
        ...(data.category !== undefined && { category: data.category }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.netAmount !== undefined && { netAmount: data.netAmount }),
        ...(data.vatAmount !== undefined && { vatAmount: data.vatAmount }),
        ...(data.grossAmount !== undefined && { grossAmount: data.grossAmount }),
        ...(data.expenseDate !== undefined && {
          expenseDate: parseExpenseDate(data.expenseDate),
        }),
        ...(data.paymentStatus !== undefined && { paymentStatus: data.paymentStatus }),
        ...(data.supplier !== undefined && {
          supplier: data.supplier?.trim() || null,
        }),
        ...(refs && {
          orderId: refs.orderId,
          projectId: refs.projectId,
          customerId: refs.customerId,
        }),
        ...(data.internalNote !== undefined && {
          internalNote: data.internalNote?.trim() || null,
        }),
        ...(data.isInvestment !== undefined && { isInvestment: data.isInvestment }),
      },
    });

    return apiSuccess(toExpenseDTO(expense), 200, NO_STORE_HEADERS);
  } catch (err) {
    console.error("[finance/expenses PATCH]", err);
    return apiError(mapExpensePrismaError(err), 500);
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const existing = await prisma.expense.findFirst({
    where: { id, tenantId: auth.tenantId },
  });
  if (!existing) return apiError("Ausgabe nicht gefunden", 404);

  if (existing.receiptStorageKey) {
    try {
      await deleteFile(existing.receiptStorageKey);
    } catch {
      // Beleg-Löschung soll Ausgabe-Löschung nicht blockieren
    }
  }

  try {
    await prisma.expense.delete({ where: { id } });
    return apiSuccess({ deleted: true }, 200, NO_STORE_HEADERS);
  } catch (err) {
    console.error("[finance/expenses DELETE]", err);
    return apiError(mapExpensePrismaError(err), 500);
  }
}
