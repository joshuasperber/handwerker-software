import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/auth/can-access";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessDashboard, canAccessMonteurApp, getDashboardNavItems, getRoleHomePath } from "@/lib/permissions";
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
  if (!canAccessDashboard(session.role)) redirect(getRoleHomePath(session.role));

  const dbUser = await prisma.user.findFirst({
    where: { id: session.id, tenantId: session.tenantId },
    select: { avatarUrl: true },
  });
  const sessionWithAvatar = { ...session, avatarUrl: dbUser?.avatarUrl ?? null };

  const navItems = getDashboardNavItems(session.role);

  return (
    <SessionProvider user={sessionWithAvatar}>
      <DashboardShell
        navItems={navItems}
        session={sessionWithAvatar}
        roleLabel={ROLE_LABELS[session.role] ?? session.role}
        canAccessMonteur={canAccessMonteurApp(session.role)}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
