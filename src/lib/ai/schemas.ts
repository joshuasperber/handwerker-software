import { z } from "zod";

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(4000),
  sessionId: z.string().optional(),
  disambiguationChoice: z.enum(["employee", "customer"]).optional(),
  disambiguationName: z.string().optional(),
});

export const createSessionSchema = z.object({
  title: z.string().max(200).optional(),
});
