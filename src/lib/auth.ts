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
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function login(
  email: string,
  password: string,
  tenantSlug?: string
): Promise<SessionUser | null> {
  const where = tenantSlug
    ? { email, tenant: { slug: tenantSlug }, isActive: true }
    : { email, isActive: true };

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

  return {
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    avatarUrl: user.avatarUrl,
    mustChangePassword: user.mustChangePassword,
  };
}
