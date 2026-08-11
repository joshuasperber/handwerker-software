import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { parseLocalDateInput } from "./period";
import type { z } from "zod";
import type { expenseInputSchema } from "./schemas";

export type ExpenseInput = z.infer<typeof expenseInputSchema>;

export function parseExpenseDate(value: string): Date {
  const local = parseLocalDateInput(value);
  return new Date(local.getFullYear(), local.getMonth(), local.getDate(), 12, 0, 0, 0);
}

/** Prüft optionale FKs — ungültige IDs werden zu null (kein 500). */
export async function resolveExpenseRelations(
  tenantId: string,
  data: Pick<ExpenseInput, "orderId" | "projectId" | "customerId">
): Promise<{ orderId: string | null; projectId: string | null; customerId: string | null }> {
  let orderId =
    typeof data.orderId === "string" && data.orderId.trim() ? data.orderId.trim() : null;
  let projectId =
    typeof data.projectId === "string" && data.projectId.trim() ? data.projectId.trim() : null;
  let customerId =
    typeof data.customerId === "string" && data.customerId.trim()
      ? data.customerId.trim()
      : null;

  if (orderId) {
    const order = await prisma.order.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, customerId: true },
    });
    if (!order) orderId = null;
    else if (!customerId) customerId = order.customerId;
  }

  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, tenantId },
      select: { id: true },
    });
    if (!project) projectId = null;
  }

  if (customerId) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, tenantId },
      select: { id: true },
    });
    if (!customer) customerId = null;
  }

  return { orderId, projectId, customerId };
}

export function mapExpensePrismaError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2003") {
      return "Auftrag oder Projekt konnte nicht verknüpft werden. Bitte erneut ohne Verknüpfung speichern.";
    }
    if (err.code === "P2025") {
      return "Ausgabe wurde nicht gefunden.";
    }
  }
  const msg = err instanceof Error ? err.message : String(err);
  if (/Expense|does not exist|relation/i.test(msg)) {
    return "Ausgaben-Tabelle nicht verfügbar. Bitte Datenbank-Migration ausführen.";
  }
  return "Ausgabe konnte nicht gespeichert werden. Bitte Eingaben prüfen und erneut versuchen.";
}
