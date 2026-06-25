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
