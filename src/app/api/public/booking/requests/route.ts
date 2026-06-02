import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookingSchema, createBooking } from "@/lib/booking";
import { apiSuccess, apiError } from "@/lib/api";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";
  let tenantSlug: string;
  let data: Parameters<typeof createBooking>[1];
  const photoFiles: { buffer: Buffer; name: string; type: string }[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const jsonData = formData.get("data");
    if (!jsonData || typeof jsonData !== "string") {
      return apiError("Ungültige Formulardaten", 400);
    }
    const raw = JSON.parse(jsonData);
    tenantSlug = raw.tenant;
    const parsed = bookingSchema.safeParse(raw);
    if (!parsed.success) return apiError("Ungültige Buchungsdaten", 400);
    data = parsed.data;

    for (const [key, value] of formData.entries()) {
      if (key.startsWith("photo") && value instanceof File) {
        const buffer = Buffer.from(await value.arrayBuffer());
        photoFiles.push({ buffer, name: value.name, type: value.type });
      }
    }
  } else {
    const body = await request.json();
    tenantSlug = body.tenant;
    const parsed = bookingSchema.safeParse(body);
    if (!parsed.success) return apiError("Ungültige Buchungsdaten", 400);
    data = parsed.data;
  }

  if (!tenantSlug) return apiError("Parameter 'tenant' fehlt", 400);

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

  const result = await createBooking(tenant.id, data, photoFiles);
  return apiSuccess(result, 201);
}
