import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  BOOKING_PHOTO_LIMIT,
  BOOKING_PHOTO_MAX_BYTES,
  BOOKING_PHOTO_TYPES,
  BookingInputError,
  bookingSchema,
  createBooking,
} from "@/lib/booking";
import { apiSuccess, apiError, getClientIp } from "@/lib/api";
import { isActionRateLimited, recordActionAttempt } from "@/lib/auth/action-rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) return apiError("Betrieb nicht gefunden", 404);

  const contentType = request.headers.get("content-type") ?? "";
  let data: Parameters<typeof createBooking>[1];
  const photoFiles: { buffer: Buffer; name: string; type: string }[] = [];

  try {
    if (contentType.includes("multipart/form-data")) {
      const contentLength = Number(request.headers.get("content-length"));
      const maxRequestBytes = BOOKING_PHOTO_LIMIT * BOOKING_PHOTO_MAX_BYTES + 1024 * 1024;
      if (Number.isFinite(contentLength) && contentLength > maxRequestBytes) {
        return apiError("Die Anfrage ist zu groß", 413);
      }

      const formData = await request.formData();
      const jsonData = formData.get("data");
      if (!jsonData || typeof jsonData !== "string") {
        return apiError("Ungültige Formulardaten", 400);
      }
      const parsed = bookingSchema.safeParse(JSON.parse(jsonData));
      if (!parsed.success) return apiError("Ungültige Buchungsdaten", 400);
      data = parsed.data;

      for (const [key, value] of formData.entries()) {
        if (key.startsWith("photo") && value instanceof File) {
          if (photoFiles.length >= BOOKING_PHOTO_LIMIT) {
            return apiError(`Maximal ${BOOKING_PHOTO_LIMIT} Fotos erlaubt`, 400);
          }
          if (value.size > BOOKING_PHOTO_MAX_BYTES) {
            return apiError("Ein Foto darf maximal 15 MB groß sein", 400);
          }
          if (!BOOKING_PHOTO_TYPES.has(value.type)) {
            return apiError("Nur JPEG-, PNG-, WebP- oder HEIC-Fotos sind erlaubt", 400);
          }
          const buffer = Buffer.from(await value.arrayBuffer());
          photoFiles.push({ buffer, name: value.name, type: value.type });
        }
      }
    } else {
      const body = await request.json();
      const parsed = bookingSchema.safeParse(body);
      if (!parsed.success) return apiError("Ungültige Buchungsdaten", 400);
      data = parsed.data;
    }
  } catch {
    return apiError("Ungültige Formulardaten", 400);
  }

  const scope = `${tenant.id}:${getClientIp(request) ?? data.email.toLowerCase()}`;
  const rate = await isActionRateLimited("public_booking", scope);
  if (rate.limited) return apiError(rate.reason ?? "Zu viele Anfragen", 429);
  await recordActionAttempt("public_booking", scope, getClientIp(request));

  try {
    const result = await createBooking(tenant.id, data, photoFiles);
    return apiSuccess(result, 201);
  } catch (error) {
    if (error instanceof BookingInputError) return apiError(error.message, 409);
    console.error("[public booking]", error);
    return apiError("Die Buchung konnte nicht gespeichert werden.", 500);
  }
}
