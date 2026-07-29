import { z } from "zod";

export const createOrderSchema = z.object({
  customerId: z.string().min(1, "Kunde fehlt"),
  propertyId: z.string().min(1, "Objekt fehlt"),
  serviceIds: z.array(z.string().min(1)).min(1, "Mindestens eine Leistung wählen"),
  description: z.string().optional(),
  internalNotes: z.string().optional(),
});

export const toggleChecklistSchema = z.object({
  checklistId: z.string().min(1, "Checklistenpunkt fehlt"),
  isChecked: z.boolean(),
});

export const applyChecklistTemplateSchema = z.object({
  templateId: z.string().min(1, "Vorlage fehlt"),
});

export const assignEmployeesSchema = z.object({
  employeeIds: z.array(z.string().min(1)).min(1, "Mindestens ein Mitarbeiter"),
  phaseId: z.string().optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  notify: z.boolean().optional().default(true),
  isTentative: z.boolean().optional(),
});

export const monteurCreateAppointmentSchema = z.object({
  customerId: z.string().min(1, "Kunde fehlt"),
  propertyId: z.string().min(1, "Objekt fehlt"),
  title: z.string().min(1, "Titel fehlt"),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  description: z.string().optional(),
  phaseType: z.string().optional(),
});

/** Termin aus dem Team-Kalender: bestehenden Auftrag einplanen oder neu anlegen. */
export const calendarCreateAppointmentSchema = z
  .object({
    mode: z.enum(["existing", "new", "standalone"]),
    startTime: z.string().datetime(),
    endTime: z.string().datetime(),
    employeeId: z.string().optional().nullable(),
    teamId: z.string().optional().nullable(),
    vehicleId: z.string().optional().nullable(),
    projectId: z.string().optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    title: z.string().max(200).optional().nullable(),
    color: z.string().max(32).optional().nullable(),
    status: z
      .enum(["GEPLANT", "UNTERWEGS", "ANGEKOMMEN", "IN_ARBEIT", "ABGESCHLOSSEN", "STORNIERT"])
      .optional(),
    addressText: z.string().max(500).optional().nullable(),
    // existing
    orderId: z.string().optional(),
    // new
    customerId: z.string().optional(),
    propertyId: z.string().optional(),
    orderTypeId: z.string().optional().nullable(),
    orderTypeCustom: z.string().max(200).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    if (new Date(data.endTime) <= new Date(data.startTime)) {
      ctx.addIssue({ code: "custom", message: "Ende muss nach Beginn liegen", path: ["endTime"] });
    }
    if (data.mode === "existing" && !data.orderId) {
      ctx.addIssue({ code: "custom", message: "Auftrag fehlt", path: ["orderId"] });
    }
    if (data.mode === "standalone" && !data.title?.trim()) {
      ctx.addIssue({ code: "custom", message: "Titel fehlt", path: ["title"] });
    }
    if (data.mode === "new") {
      if (!data.title?.trim()) {
        ctx.addIssue({ code: "custom", message: "Titel fehlt", path: ["title"] });
      }
      if (!data.customerId) {
        ctx.addIssue({ code: "custom", message: "Kunde fehlt", path: ["customerId"] });
      }
      if (!data.propertyId) {
        ctx.addIssue({ code: "custom", message: "Adresse / Objekt fehlt", path: ["propertyId"] });
      }
    }
  });

export const appointmentUpdateSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  employeeId: z.string().nullable().optional(),
  teamId: z.string().nullable().optional(),
  vehicleId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  orderId: z.string().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  color: z.string().max(32).nullable().optional(),
  addressText: z.string().max(500).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  status: z
    .enum(["GEPLANT", "UNTERWEGS", "ANGEKOMMEN", "IN_ARBEIT", "ABGESCHLOSSEN", "STORNIERT"])
    .optional(),
});
