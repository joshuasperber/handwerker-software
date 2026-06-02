import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function GET() {
  const auth = await requireAuth("calculations.read");
  if (auth instanceof Response) return auth;

  const costs = await prisma.monthlyFixedCost.findMany({
    where: { tenantId: auth.tenantId },
    orderBy: { category: "asc" },
  });

  const total = costs.filter((c) => c.isActive).reduce((s, c) => s + c.amountNet, 0);

  return apiSuccess({ costs, monthlyTotal: total });
}

export async function POST(request: Request) {
  const auth = await requireAuth("calculations.settings");
  if (auth instanceof Response) return auth;

  const body = await request.json();
  if (!body.name || body.amountNet == null) {
    return apiError("Name und Betrag sind Pflicht", 400);
  }

  const cost = await prisma.monthlyFixedCost.create({
    data: {
      tenantId: auth.tenantId,
      name: body.name,
      category: body.category ?? "SONSTIGE",
      amountNet: Number(body.amountNet),
      notes: body.notes,
    },
  });

  return apiSuccess(cost, 201);
}
