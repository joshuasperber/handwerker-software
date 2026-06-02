import Link from "next/link";
import { redirect } from "next/navigation";
import { Wrench, LogOut } from "lucide-react";
import { DashboardSearch } from "@/components/dashboard/search";
import { DashboardSidebarNav } from "@/components/dashboard/sidebar-nav";
import { SessionProvider } from "@/components/auth/can-access";
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
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden lg:flex w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white h-full overflow-y-auto">
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-6">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d5c63] text-white">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="font-bold text-slate-900">Handwerker App</span>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <DashboardSidebarNav items={navItems} />
        </nav>
        <div className="border-t border-slate-100 p-4">
          <p className="text-xs text-slate-400 mb-2">
            {session.firstName} {session.lastName}
            <span className="block text-[10px] uppercase tracking-wide mt-0.5">{ROLE_LABELS[session.role] ?? session.role}</span>
          </p>
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600">
              <LogOut className="h-4 w-4" /> Abmelden
            </button>
          </form>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <header className="hidden lg:flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
          <DashboardSearch />
          <div className="flex items-center gap-4 text-sm text-slate-500">
            {canAccessMonteurApp(session.role) && (
              <Link href="/monteur" className="text-[#0d5c63] hover:underline">Monteur-App</Link>
            )}
            <span>{session.firstName} {session.lastName}</span>
          </div>
        </header>
        <header className="flex h-16 items-center justify-between border-b border-slate-200 bg-white px-6 lg:hidden">
          <span className="font-bold">Handwerker App</span>
          {canAccessMonteurApp(session.role) && (
            <Link href="/monteur" className="text-sm text-[#0d5c63]">Monteur-App</Link>
          )}
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
    </SessionProvider>
  );
}
