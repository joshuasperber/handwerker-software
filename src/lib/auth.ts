import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  type SessionUser,
  createSession,
  getSession,
  setSessionCookie,
  clearSessionCookie,
  verifySession,
  COOKIE_NAME,
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
  verifySession,
  COOKIE_NAME,
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
  };
}

/**
 * Login via Supabase Auth when configured; falls back to bcrypt hash.
 * Tenant binding comes from the Prisma user (no hidden demo slug required).
 */
export async function login(
  email: string,
  password: string,
  tenantSlug?: string
): Promise<SessionUser | null> {
  const normalizedEmail = email.toLowerCase().trim();

  if (isSupabaseAuthConfigured()) {
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
            data: { supabaseUserId: auth.supabaseUserId, lastLoginAt: new Date() },
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
  }

  const where = tenantSlug
    ? { email: normalizedEmail, tenant: { slug: tenantSlug }, isActive: true }
    : { email: normalizedEmail, isActive: true };

  const user = await prisma.user.findFirst({
    where,
    include: { tenant: true },
  });

  if (!user) return null;

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return null;

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return toSessionUser(user);
}
