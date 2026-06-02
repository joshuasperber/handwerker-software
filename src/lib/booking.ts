import { z } from "zod";
import { prisma } from "./prisma";
import { generateOrderNumber, formatDateTime } from "./utils";
import { createAuditLog } from "./audit";
import { notifyBookingConfirmation } from "./notifications";
import { uploadFile } from "./storage";

export const bookingSchema = z.object({
  serviceIds: z.array(z.string()).min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  street: z.string().min(1),
  zipCode: z.string().min(4),
  city: z.string().min(1),
  description: z.string().optional(),
  questionAnswers: z.record(z.string(), z.unknown()).optional(),
  gdprConsent: z.literal(true),
  slotStart: z.string().datetime().optional(),
  slotEnd: z.string().datetime().optional(),
  employeeId: z.string().optional(),
  priority: z.enum(["NORMAL", "DRINGEND", "NOTFALL"]).optional(),
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

  let customer = await prisma.customer.findUnique({
    where: { tenantId_email: { tenantId, email: data.email } },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        gdprConsent: true,
        gdprConsentAt: new Date(),
      },
    });
  }

  const property = await prisma.property.create({
    data: {
      tenantId,
      customerId: customer.id,
      label: "Einsatzort",
      street: data.street,
      zipCode: data.zipCode,
      city: data.city,
    },
  });

  const order = await prisma.order.create({
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
        create: data.serviceIds.map((serviceId) => ({ serviceId })),
      },
    },
  });

  if (hasSlot) {
    await prisma.appointment.create({
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

  for (const photo of photoFiles) {
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
  }

  await createAuditLog({
    tenantId,
    entityType: "Order",
    entityId: order.id,
    action: "BOOKING_CREATED",
    newValues: { orderNumber, status: order.status, priority },
  });

  if (hasSlot) {
    await notifyBookingConfirmation(
      tenantId,
      data.email,
      orderNumber,
      formatDateTime(data.slotStart!)
    );
  }

  return { orderNumber, orderId: order.id, status: order.status };
}
