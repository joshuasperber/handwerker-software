import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateServiceArea } from "@/lib/service-area";
import { apiSuccess, apiError } from "@/lib/api";

const schema = z.object({
  tenant: z.string(),
  zipCode: z.string().min(4).max(10),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Ungültige PLZ", 400);

  const tenant = await prisma.tenant.findUnique({ where: { slug: parsed.data.tenant } });
  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

  const result = await validateServiceArea(tenant.id, parsed.data.zipCode);
  return apiSuccess(result);
}
