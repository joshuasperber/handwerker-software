import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { expenseInputSchema } from "@/lib/finance/schemas";
import { toExpenseDTO } from "@/lib/finance/overview";
import { parseLocalDateInput } from "@/lib/finance/period";
import { deleteFile } from "@/lib/storage";

function parseExpenseDate(value: string): Date {
  const local = parseLocalDateInput(value);
  return new Date(local.getFullYear(), local.getMonth(), local.getDate(), 12, 0, 0, 0);
}

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

  const body = await request.json();
  const parsed = expenseInputSchema.partial().safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const data = parsed.data;
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
      ...(data.supplier !== undefined && { supplier: data.supplier }),
      ...(data.orderId !== undefined && { orderId: data.orderId || null }),
      ...(data.customerId !== undefined && { customerId: data.customerId || null }),
      ...(data.projectId !== undefined && { projectId: data.projectId || null }),
      ...(data.internalNote !== undefined && { internalNote: data.internalNote }),
      ...(data.isInvestment !== undefined && { isInvestment: data.isInvestment }),
    },
  });

  return apiSuccess(toExpenseDTO(expense), 200, NO_STORE_HEADERS);
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

  await prisma.expense.delete({ where: { id } });
  return apiSuccess({ deleted: true }, 200, NO_STORE_HEADERS);
}
