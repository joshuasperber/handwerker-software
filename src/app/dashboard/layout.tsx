import { redirect } from "next/navigation";
import { SessionProvider } from "@/components/auth/can-access";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getSession } from "@/lib/auth";
import { canAccessDashboard, canAccessMonteurApp, getDashboardNavItems } from "@/lib/permissions";
import { ROLE_LABELS } from "@/lib/utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessDashboard(session.role)) redirect("/monteur");

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
