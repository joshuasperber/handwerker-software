import { z } from "zod";
import { prisma } from "./prisma";
import { generateOrderNumber } from "./utils";
import { createAuditLog } from "./audit";
import { sendBookingConfirmationForOrder } from "./customer-email-notifications";
import { uploadFile, isStorageConfigured } from "./storage";

const customServiceSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).optional(),
  quantity: z.number().int().positive().max(10_000).optional(),
});

export class BookingInputError extends Error {}

export const BOOKING_PHOTO_LIMIT = 5;
export const BOOKING_PHOTO_MAX_BYTES = 15 * 1024 * 1024;
export const BOOKING_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

export const bookingSchema = z
  .object({
    serviceIds: z.array(z.string().min(1).max(64)).max(20).default([]),
    customServices: z.array(customServiceSchema).max(20).optional(),
    firstName: z.string().trim().min(1).max(100),
    lastName: z.string().trim().min(1).max(100),
    email: z.string().trim().email().max(254),
    phone: z.string().trim().max(50).optional(),
    street: z.string().trim().min(1).max(200),
    zipCode: z.string().trim().min(4).max(10),
    city: z.string().trim().min(1).max(100),
    description: z.string().trim().max(5000).optional(),
    questionAnswers: z.record(z.string(), z.unknown()).optional(),
    gdprConsent: z.literal(true),
    slotStart: z.string().datetime().optional(),
    slotEnd: z.string().datetime().optional(),
    employeeId: z.string().max(64).optional(),
    priority: z.enum(["NORMAL", "DRINGEND", "NOTFALL"]).optional(),
  })
  .refine(
    (d) => d.serviceIds.length > 0 || (d.customServices?.length ?? 0) > 0,
    { message: "Mindestens eine Leistung erforderlich", path: ["serviceIds"] }
  )
  .refine((d) => new Set(d.serviceIds).size === d.serviceIds.length, {
    message: "Leistungen dürfen nicht doppelt gewählt werden",
    path: ["serviceIds"],
  })
  .refine((d) => Boolean(d.slotStart) === Boolean(d.slotEnd), {
    message: "Start und Ende des Termins müssen gemeinsam angegeben werden",
    path: ["slotStart"],
  })
  .refine((d) => !d.slotStart || Boolean(d.employeeId), {
    message: "Für einen Termin ist ein Mitarbeiter erforderlich",
    path: ["employeeId"],
  });

export type BookingData = z.infer<typeof bookingSchema>;

export async function createBooking(
  tenantId: string,
  data: BookingData,
  photoFiles: { buffer: Buffer; name: string; type: string }[] = []
) {
  const orderNumber = generateOrderNumber();
  const hasSlot = data.slotStart && data.slotEnd;
  const priority = data.priority ?? "NORMAL";
  const normalizedEmail = data.email.toLowerCase();

  let booking;
  try {
    booking = await prisma.$transaction(async (tx) => {
      if (data.serviceIds.length) {
        const services = await tx.service.findMany({
          where: {
            id: { in: data.serviceIds },
            tenantId,
            isActive: true,
          },
          select: { id: true },
        });
        if (services.length !== data.serviceIds.length) {
          throw new BookingInputError("Mindestens eine gewählte Leistung ist nicht verfügbar.");
        }
      }

      if (hasSlot) {
        const start = new Date(data.slotStart!);
        const end = new Date(data.slotEnd!);
        if (end <= start) {
          throw new BookingInputError("Das Terminende muss nach dem Beginn liegen.");
        }
        if (start.getTime() < Date.now() - 5 * 60 * 1000) {
          throw new BookingInputError("Der Termin liegt bereits in der Vergangenheit.");
        }
        if (end.getTime() - start.getTime() > 12 * 60 * 60 * 1000) {
          throw new BookingInputError("Der Termin ist länger als 12 Stunden.");
        }

        const employee = await tx.employee.findFirst({
          where: {
            id: data.employeeId!,
            tenantId,
            user: { isActive: true },
          },
          select: { id: true },
        });
        if (!employee) {
          throw new BookingInputError("Der gewählte Mitarbeiter ist nicht verfügbar.");
        }

        const collision = await tx.appointment.findFirst({
          where: {
            tenantId,
            employeeId: employee.id,
            status: { not: "STORNIERT" },
            startTime: { lt: end },
            endTime: { gt: start },
          },
          select: { id: true },
        });
        if (collision) {
          throw new BookingInputError(
            "Der Termin wurde inzwischen vergeben. Bitte wählen Sie einen anderen Zeitpunkt."
          );
        }
      }

      let customer = await tx.customer.findUnique({
        where: { tenantId_email: { tenantId, email: normalizedEmail } },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            tenantId,
            firstName: data.firstName,
            lastName: data.lastName,
            email: normalizedEmail,
            phone: data.phone,
            gdprConsent: true,
            gdprConsentAt: new Date(),
          },
        });
      }

      const property = await tx.property.create({
        data: {
          tenantId,
          customerId: customer.id,
          label: "Einsatzort",
          street: data.street,
          zipCode: data.zipCode,
          city: data.city,
        },
      });

      const order = await tx.order.create({
        data: {
          tenantId,
          customerId: customer.id,
          propertyId: property.id,
          orderNumber,
          status: hasSlot ? "TERMIN_GEBUCHT" : "NEUE_ANFRAGE",
          priority,
          description: data.description,
          questionAnswers: data.questionAnswers as object | undefined,
          scheduledStart: hasSlot ? new Date(data.slotStart!) : undefined,
          scheduledEnd: hasSlot ? new Date(data.slotEnd!) : undefined,
          services: {
            create: [
              ...data.serviceIds.map((serviceId) => ({ serviceId })),
              ...(data.customServices ?? [])
                .filter((c) => c.name.trim())
                .map((c) => ({
                  customName: c.name.trim(),
                  description: c.description?.trim() || null,
                  quantity: c.quantity && c.quantity > 0 ? Math.round(c.quantity) : 1,
                })),
            ],
          },
        },
      });

      if (hasSlot) {
        await tx.appointment.create({
          data: {
            tenantId,
            orderId: order.id,
            employeeId: data.employeeId,
            startTime: new Date(data.slotStart!),
            endTime: new Date(data.slotEnd!),
            status: "GEPLANT",
          },
        });
      }

      return { customer, property, order };
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if ((error as { code?: string }).code === "P2034") {
      throw new BookingInputError(
        "Die Buchung hat sich mit einer parallelen Anfrage überschnitten. Bitte erneut versuchen."
      );
    }
    throw error;
  }

  const { customer, property, order } = booking;
  const warnings: string[] = [];

  if (photoFiles.length > 0 && !isStorageConfigured()) {
    console.warn("[booking] Fotos übersprungen – Dateispeicher nicht konfiguriert");
    warnings.push("Fotos konnten nicht gespeichert werden, weil der Dateispeicher nicht konfiguriert ist.");
  }
  for (const photo of photoFiles) {
    if (!isStorageConfigured()) continue;
    try {
      const { key } = await uploadFile(photo.buffer, photo.name, photo.type, `orders/${order.id}`);
      await prisma.fileUpload.create({
        data: {
          orderId: order.id,
          fileName: photo.name,
          mimeType: photo.type,
          sizeBytes: photo.buffer.length,
          storageKey: key,
          category: "KUNDENFOTO",
        },
      });
    } catch (error) {
      console.error("[booking] Foto konnte nach der Buchung nicht gespeichert werden", error);
      if (!warnings.some((warning) => warning.startsWith("Mindestens ein Foto"))) {
        warnings.push("Mindestens ein Foto konnte nicht gespeichert werden.");
      }
    }
  }

  try {
    await createAuditLog({
      tenantId,
      entityType: "Order",
      entityId: order.id,
      action: "BOOKING_CREATED",
      newValues: { orderNumber, status: order.status, priority },
    });
  } catch (error) {
    console.error("[booking] Audit-Eintrag konnte nicht geschrieben werden", error);
  }

  if (hasSlot) {
    try {
      await sendBookingConfirmationForOrder({
        tenantId,
        orderId: order.id,
        orderNumber,
        customer,
        appointmentStart: new Date(data.slotStart!),
        city: property.city,
      });
    } catch (error) {
      console.error("[booking] Bestätigung konnte nach der Buchung nicht verarbeitet werden", error);
      warnings.push("Die Buchung wurde gespeichert, die Bestätigung konnte aber nicht versendet werden.");
    }
  }

  return {
    orderNumber,
    orderId: order.id,
    status: order.status,
    ...(warnings.length > 0 ? { warnings } : {}),
  };
}
