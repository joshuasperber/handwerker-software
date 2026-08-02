import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/auth/can-access";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { toAvatarSrc } from "@/lib/avatar";
import {
  canAccessManagementView,
  canSwitchAppViews,
  getDashboardNavItems,
} from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "GAST") redirect("/portal");
  if (session.role === "KUNDE") redirect("/kunde");

  // Feldrollen gehören nicht in die Verwaltung — Middleware leitet um; Layout als zweite Sicherung.
  if (!canAccessManagementView(session.role)) {
    redirect("/monteur/heute");
  }

  let sessionWithAvatar = session;
  try {
    const dbUser = await prisma.user.findFirst({
      where: { id: session.id, tenantId: session.tenantId },
      select: { avatarUrl: true, updatedAt: true, canManageRoles: true },
    });
    sessionWithAvatar = {
      ...session,
      avatarUrl: toAvatarSrc(dbUser?.avatarUrl, dbUser?.updatedAt),
      canManageRoles: dbUser?.canManageRoles ?? session.canManageRoles ?? false,
    };
  } catch (error) {
    console.error("[dashboard/layout] avatar load failed:", error);
  }

  const navItems = getDashboardNavItems(sessionWithAvatar.role, {
    canManageRoles: sessionWithAvatar.canManageRoles,
  });

  return (
    <SessionProvider user={sessionWithAvatar}>
      <DashboardShell
        navItems={navItems}
        session={sessionWithAvatar}
        roleLabel={ROLE_LABELS[session.role] ?? session.role}
        canSwitchToWork={canSwitchAppViews(session.role)}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
