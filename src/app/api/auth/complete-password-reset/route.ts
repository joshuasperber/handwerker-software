import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { apiError, apiSuccess } from "@/lib/api";
import { clearSessionCookiesOnResponse, hashPassword } from "@/lib/auth";
import { selectPasswordResetUser } from "@/lib/auth/password-reset";
import { prisma } from "@/lib/prisma";
import { updateSupabaseAuthPassword } from "@/lib/supabase/auth-users";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";
import { assertSameOrigin } from "@/lib/security/origin";

const schema = z.object({
  password: z.string().min(8, "Passwort muss mindestens 8 Zeichen haben"),
});

/**
 * Schließt einen Supabase-Recovery-Vorgang auch im lokalen Benutzerkonto ab.
 * Der Bearer-Token stammt ausschließlich aus der aktiven Recovery-Session und
 * wird serverseitig bei Supabase verifiziert, bevor lokale Zugangsdaten ändern.
 */
export async function POST(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe");
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length).trim()
    : "";
  if (!accessToken) return apiError("Reset-Sitzung fehlt oder ist abgelaufen", 401);

  const supabase = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);
  const authUser = authData.user;
  if (authError || !authUser?.email) {
    return apiError("Reset-Sitzung ist ungültig oder abgelaufen", 401);
  }

  const exactUser = await prisma.user.findFirst({
    where: { isActive: true, supabaseUserId: authUser.id },
  });
  const candidates = exactUser
    ? [exactUser]
    : await prisma.user.findMany({
        where: {
          isActive: true,
          supabaseUserId: null,
          email: authUser.email.toLowerCase().trim(),
        },
        take: 2,
      });
  const user = selectPasswordResetUser(candidates, authUser.id);
  if (!user) return apiError("Zugehöriges JoMaster-Konto wurde nicht gefunden", 404);

  const supabaseUpdate = await updateSupabaseAuthPassword(
    authUser.id,
    parsed.data.password
  );
  if (!supabaseUpdate.ok) return apiError(supabaseUpdate.error, 400);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      supabaseUserId: authUser.id,
      mustChangePassword: false,
      sessionVersion: { increment: 1 },
    },
  });

  const response = apiSuccess({ completed: true });
  clearSessionCookiesOnResponse(response);
  return response;
}
