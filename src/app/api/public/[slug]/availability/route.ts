import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateAvailability } from "@/lib/availability";
import { apiSuccess, apiError } from "@/lib/api";

const schema = z.object({
  serviceIds: z.array(z.string()).min(1),
  zipCode: z.string().min(4).max(10),
  fromDate: z.string().datetime().optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Ungültige Anfrage", 400);

  const slots = await calculateAvailability({
    tenantId: tenant.id,
    serviceIds: parsed.data.serviceIds,
    zipCode: parsed.data.zipCode,
    fromDate: parsed.data.fromDate ? new Date(parsed.data.fromDate) : new Date(),
  });

  return apiSuccess({
    slots: slots.map((s) => ({
      start: s.start.toISOString(),
      end: s.end.toISOString(),
      employeeId: s.employeeId,
      employeeName: s.employeeName,
    })),
  });
}
