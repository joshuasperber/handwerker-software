"use client";

import { createContext, useContext, type ReactNode } from "react";
import { hasPermission, type Permission } from "@/lib/permissions";
import type { SessionUser } from "@/lib/auth";

const SessionContext = createContext<SessionUser | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: SessionUser;
  children: ReactNode;
}) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return session;
}

export function usePermission(permission: Permission): boolean {
  const { role } = useSession();
  return hasPermission(role, permission);
}

export function CanAccess({
  permission,
  children,
  fallback = null,
}: {
  permission: Permission;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const allowed = usePermission(permission);
  return allowed ? <>{children}</> : <>{fallback}</>;
}
