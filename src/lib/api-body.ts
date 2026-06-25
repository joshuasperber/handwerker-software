import { z } from "zod";
import { apiError } from "@/lib/api";

export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T
): Promise<z.infer<T> | Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return apiError("Ungültiger JSON-Body", 400);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const message =
      parsed.error.issues.map((issue) => issue.message).join(", ") ||
      "Ungültige Eingabe";
    return apiError(message, 400);
  }

  return parsed.data;
}
