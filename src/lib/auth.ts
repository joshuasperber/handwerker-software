import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  type SessionUser,
  createSession,
  getSession,
  setSessionCookie,
  clearSessionCookie,
  clearSessionCookiesOnResponse,
  verifySession,
  COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_DURATION,
  applySessionCookie,
} from "./auth-session";
import { isSupabaseAuthConfigured } from "./supabase/env";
import { signInWithSupabasePassword } from "./supabase/auth-users";

export type { SessionUser };
export {
  createSession,
  getSession,
  setSessionCookie,
  clearSessionCookie,
  clearSessionCookiesOnResponse,
  verifySession,
  COOKIE_NAME,
  LEGACY_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_DURATION,
  applySessionCookie,
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string | null | undefined
): Promise<boolean> {
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

function toSessionUser(user: {
  id: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: SessionUser["role"];
  avatarUrl: string | null;
  mustChangePassword: boolean;
  sessionVersion: number;
  canManageRoles?: boolean;
}): SessionUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    mustChangePassword: user.mustChangePassword,
    sessionVersion: user.sessionVersion,
    canManageRoles: user.canManageRoles ?? false,
  };
}

/**
 * Login: zuerst lokaler Passwort-Hash (schnell), dann Supabase als Fallback.
 * So hängt die Anmeldung nicht an einem langsamen Supabase-Roundtrip.
 */
export async function login(
  email: string,
  password: string,
  tenantSlug?: string
): Promise<SessionUser | null> {
  const normalizedEmail = email.toLowerCase().trim();

  const where = tenantSlug
    ? { email: normalizedEmail, tenant: { slug: tenantSlug }, isActive: true }
    : { email: normalizedEmail, isActive: true };

  const localUser = await prisma.user.findFirst({
    where,
    include: { tenant: true },
  });

  if (localUser) {
    const valid = await verifyPassword(password, localUser.passwordHash);
    if (valid) {
      await prisma.user.update({
        where: { id: localUser.id },
        data: { lastLoginAt: new Date() },
      });
      return toSessionUser(localUser);
    }
  }

  if (isSupabaseAuthConfigured()) {
    try {
      const auth = await signInWithSupabasePassword(normalizedEmail, password);
      if (auth.ok) {
        const user = await prisma.user.findFirst({
          where: {
            isActive: true,
            ...(tenantSlug ? { tenant: { slug: tenantSlug } } : {}),
            OR: [
              { supabaseUserId: auth.supabaseUserId },
              { email: normalizedEmail },
            ],
          },
        });
        if (user) {
          if (!user.supabaseUserId) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                supabaseUserId: auth.supabaseUserId,
                lastLoginAt: new Date(),
              },
            });
          } else {
            await prisma.user.update({
              where: { id: user.id },
              data: { lastLoginAt: new Date() },
            });
          }
          return toSessionUser(user);
        }
      }
    } catch (err) {
      console.warn("[auth.login] Supabase sign-in failed", err);
    }
  }

  return null;
}
