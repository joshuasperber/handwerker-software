import { NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { apiError, apiSuccess } from "@/lib/api";
import {
  getSupabaseAnonKey,
  getSupabaseUrl,
  isSupabaseAuthConfigured,
} from "@/lib/supabase/env";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  email: z.string().email(),
});

/**
 * Startet Supabase Password-Recovery-Mail.
 * Antwort ist absichtlich generisch (kein Account-Enumeration).
 */
export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return apiError("Bitte gültige E-Mail angeben");
    }

    const email = parsed.data.email.toLowerCase().trim();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      request.nextUrl.origin;

    // Immer 200 — auch wenn User fehlt oder Supabase nicht konfiguriert
    if (!isSupabaseAuthConfigured()) {
      return apiSuccess({
        sent: false,
        message:
          "Passwort-Reset ist noch nicht konfiguriert. Bitte Admin kontaktieren.",
      });
    }

    const user = await prisma.user.findFirst({
      where: { email, isActive: true },
      select: { id: true, supabaseUserId: true },
    });

    if (user) {
      const anon = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error } = await anon.auth.resetPasswordForEmail(email, {
        redirectTo: `${appUrl}/passwort-setzen`,
      });
      if (error) {
        console.error("[forgot-password]", error.message);
      }
    }

    return apiSuccess({
      sent: true,
      message:
        "Wenn ein Konto existiert, wurde eine E-Mail zum Zurücksetzen gesendet.",
    });
  } catch (e) {
    console.error("[forgot-password]", e);
    return apiError("Anfrage fehlgeschlagen", 500);
  }
}
