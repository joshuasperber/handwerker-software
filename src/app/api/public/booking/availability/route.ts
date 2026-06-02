import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateAvailability } from "@/lib/availability";
import { apiSuccess, apiError } from "@/lib/api";

const schema = z.object({
  tenant: z.string(),
  serviceIds: z.array(z.string()).min(1),
  zipCode: z.string().min(4).max(10),
  fromDate: z.string().datetime().optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return apiError("Ungültige Anfrage", 400);

  const tenant = await prisma.tenant.findUnique({ where: { slug: parsed.data.tenant } });
  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

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
      label: `${s.start.toLocaleDateString("de-DE")} ${s.start.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}–${s.end.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}`,
    })),
  });
}
