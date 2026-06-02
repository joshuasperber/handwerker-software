import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth("calculations.write");
  if (auth instanceof Response) return auth;

  const { id } = await params;
  const calc = await prisma.calculation.findFirst({
    where: { id, tenantId: auth.tenantId },
  });

  if (!calc) return apiError("Kalkulation nicht gefunden", 404);

  const count = await prisma.calculationDocument.count({
    where: { calculationId: id, documentType: "OFFER" },
  });

  const doc = await prisma.calculationDocument.create({
    data: {
      calculationId: id,
      documentType: "OFFER",
      documentNumber: `ANG-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`,
      internalNote: `Netto ${calc.netSalesPrice} · Brutto ${calc.grossSalesPrice}`,
    },
  });

  return apiSuccess(doc, 201);
}
