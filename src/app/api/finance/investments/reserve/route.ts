import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError, NO_STORE_HEADERS } from "@/lib/api";
import { reserveDecisionSchema } from "@/lib/finance/schemas";
import { INVESTMENT_INCLUDE } from "@/lib/finance/investment-dto";
import { buildReserveProposal, loadReserveContext } from "@/lib/finance/investment-planning";
import { previousMonth, RESERVE_ACTIVE_STATUSES } from "@/lib/finance/investment-reserve";

export async function GET(request: NextRequest) {
  const auth = await requireAuth("invoices.read");
  if (auth instanceof Response) return auth;

  const url = new URL(request.url);
  const fallback = previousMonth(new Date());
  const year = Number(url.searchParams.get("year") ?? fallback.year);
  const month = Number(url.searchParams.get("month") ?? fallback.month);
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
    return apiError("Ungültiger Monat");
  }

  const investments = await prisma.plannedInvestment.findMany({
    where: { tenantId: auth.tenantId },
    include: INVESTMENT_INCLUDE,
  });

  const context = await loadReserveContext(auth.tenantId, year, month);
  const proposal = await buildReserveProposal(auth.tenantId, year, month, investments, context);
  return apiSuccess(proposal, 200, NO_STORE_HEADERS);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth("invoices.write");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  const parsed = reserveDecisionSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const { year, month, decisions } = parsed.data;
  const investments = await prisma.plannedInvestment.findMany({
    where: { tenantId: auth.tenantId },
    include: INVESTMENT_INCLUDE,
  });
  const proposal = await buildReserveProposal(auth.tenantId, year, month, investments);

  for (const decision of decisions) {
    const line = proposal.lines.find((l) => l.investmentId === decision.investmentId);
    const investment = investments.find((i) => i.id === decision.investmentId);
    if (!line || !investment) return apiError("Investition nicht gefunden", 404);
    if (!(RESERVE_ACTIVE_STATUSES as readonly string[]).includes(investment.status)) {
      return apiError("Für pausierte oder abgeschlossene Investitionen gibt es keinen Vorschlag");
    }
    if (line.status !== "OPEN") {
      return apiError(`Für ${investment.title} liegt in diesem Monat schon eine Entscheidung vor`);
    }

    const suggested = line.suggestedAmount;
    let status: "CONFIRMED" | "ADJUSTED" | "DEFERRED" | "IGNORED" = "IGNORED";
    let applied: number | null = null;
    if (decision.action === "confirm") {
      status = "CONFIRMED";
      applied = suggested;
    } else if (decision.action === "adjust") {
      if (decision.amount == null) return apiError("Bitte den angepassten Betrag angeben");
      status = "ADJUSTED";
      applied = decision.amount;
    } else if (decision.action === "defer") {
      status = "DEFERRED";
    }

    await prisma.$transaction(async (tx) => {
      await tx.investmentReserveMonth.create({
        data: {
          tenantId: auth.tenantId,
          investmentId: investment.id,
          year,
          month,
          suggestedAmount: suggested,
          appliedAmount: applied,
          status,
          orderCount: line.orderCount,
          explanation: line.explanation,
          carryIn: 0,
        },
      });
      if (applied != null && applied > 0) {
        const saved = (investment.savedAmount ?? 0) + applied;
        const reached = investment.plannedAmount > 0 && saved + 0.001 >= investment.plannedAmount;
        await tx.plannedInvestment.update({
          where: { id: investment.id },
          data: {
            savedAmount: Math.round(saved * 100) / 100,
            ...(reached &&
              (investment.status === "PLANNED" || investment.status === "ACTIVE") && {
                status: "GOAL_REACHED",
              }),
          },
        });
        investment.savedAmount = saved;
      }
    });
  }

  const fresh = await prisma.plannedInvestment.findMany({
    where: { tenantId: auth.tenantId },
    include: INVESTMENT_INCLUDE,
  });
  const context = await loadReserveContext(auth.tenantId, year, month);
  const next = await buildReserveProposal(auth.tenantId, year, month, fresh, context);
  return apiSuccess(next, 200, NO_STORE_HEADERS);
}
