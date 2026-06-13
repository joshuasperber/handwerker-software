import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/auth/can-access";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSession } from "@/lib/auth";
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

  const navItems = getDashboardNavItems(session.role);

  return (
    <SessionProvider user={session}>
      <DashboardShell
        navItems={navItems}
        session={session}
        roleLabel={ROLE_LABELS[session.role] ?? session.role}
        canAccessMonteur={canAccessMonteurApp(session.role)}
      >
        {children}
      </DashboardShell>
    </SessionProvider>
  );
}
