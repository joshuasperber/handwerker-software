import { NextResponse } from "next/server";
import { getSession, type SessionUser } from "./auth";
import { hasPermission, type Permission } from "./permissions";
import { prisma } from "./prisma";

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function requireAuth(
  permission?: Permission
): Promise<SessionUser | NextResponse> {
  const session = await getSession();
  if (!session) {
    return apiError("Nicht authentifiziert", 401);
  }

  const active = await prisma.user.findFirst({
    where: { id: session.id, tenantId: session.tenantId, isActive: true },
    select: { id: true },
  });
  if (!active) {
    return apiError("Nicht authentifiziert", 401);
  }

  if (permission && !hasPermission(session.role, permission)) {
    return apiError("Keine Berechtigung", 403);
  }
  return session;
}

export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim();
}
