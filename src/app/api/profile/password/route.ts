import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import {
  verifyPassword,
  hashPassword,
  createSession,
  setSessionCookie,
} from "@/lib/auth";
import { bumpSessionVersion } from "@/lib/auth/session-version";
import { updateSupabaseAuthPassword } from "@/lib/supabase/auth-users";
import { isSupabaseAuthConfigured } from "@/lib/supabase/env";

const passwordSchema = z
  .object({
    oldPassword: z.string().min(1, "Bitte aktuelles Passwort eingeben"),
    newPassword: z.string().min(6, "Neues Passwort muss mindestens 6 Zeichen haben"),
    confirmPassword: z.string().min(1, "Bitte neues Passwort bestätigen"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Die neuen Passwörter stimmen nicht überein",
    path: ["confirmPassword"],
  });

export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof Response) return auth;

  const parsed = passwordSchema.safeParse(await request.json());
  if (!parsed.success) {
    return apiError(parsed.error.issues[0]?.message ?? "Ungültige Eingabe", 400);
  }
  const { oldPassword, newPassword } = parsed.data;

  const user = await prisma.user.findFirst({
    where: { id: auth.id, tenantId: auth.tenantId },
  });
  if (!user) return apiError("Benutzer nicht gefunden", 404);

  let oldValid = await verifyPassword(oldPassword, user.passwordHash);
  if (!oldValid && isSupabaseAuthConfigured() && user.supabaseUserId) {
    const { signInWithSupabasePassword } = await import("@/lib/supabase/auth-users");
    const check = await signInWithSupabasePassword(user.email, oldPassword);
    oldValid = check.ok;
  }
  if (!oldValid) return apiError("Aktuelles Passwort ist falsch", 400);

  if (user.passwordHash && (await verifyPassword(newPassword, user.passwordHash))) {
    return apiError("Neues Passwort muss sich vom alten unterscheiden", 400);
  }

  if (isSupabaseAuthConfigured()) {
    if (user.supabaseUserId) {
      const updated = await updateSupabaseAuthPassword(user.supabaseUserId, newPassword);
      if (!updated.ok) return apiError(updated.error, 400);
    } else {
      const { createSupabaseAuthUser } = await import("@/lib/supabase/auth-users");
      const created = await createSupabaseAuthUser({
        email: user.email,
        password: newPassword,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      if (!created.ok) return apiError(created.error, 400);
      await prisma.user.update({
        where: { id: user.id },
        data: { supabaseUserId: created.supabaseUserId },
      });
    }
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(newPassword),
      mustChangePassword: false,
    },
  });

  await bumpSessionVersion(user.id);

  const updated = await prisma.user.findFirstOrThrow({ where: { id: user.id } });

  const token = await createSession({
    id: updated.id,
    tenantId: updated.tenantId,
    email: updated.email,
    firstName: updated.firstName,
    lastName: updated.lastName,
    role: updated.role,
    avatarUrl: updated.avatarUrl,
    mustChangePassword: updated.mustChangePassword,
    sessionVersion: updated.sessionVersion,
  });
  await setSessionCookie(token);

  return apiSuccess({ success: true });
}
