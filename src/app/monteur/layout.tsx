import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessMonteurApp, getRoleHomePath } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Wrench, LogOut, AlertTriangle } from "lucide-react";
import { Suspense } from "react";
import { MonteurBottomNav } from "@/components/monteur/bottom-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SessionProvider } from "@/components/auth/can-access";

export default async function MonteurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "KUNDE") redirect("/kunde");
  if (session.role === "GAST") redirect("/portal");
  if (!canAccessMonteurApp(session.role)) redirect(getRoleHomePath(session.role));

  const employee = await prisma.employee.findFirst({
    where: { userId: session.id, tenantId: session.tenantId },
    select: { id: true },
  });

  return (
    <SessionProvider user={session}>
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-slate-900">Monteur</span>
        </div>
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link href="/dashboard/profil" className="text-sm text-slate-500 hover:text-blue-600">
            {session.firstName}
          </Link>
          {session.role !== "MONTEUR" && (
            <Link href="/dashboard" className="text-sm text-blue-600">Dashboard</Link>
          )}
          <form action="/api/auth/logout" method="POST">
            <button type="submit"><LogOut className="h-4 w-4 text-slate-400" /></button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 pb-20">
        {session.mustChangePassword && (
          <Link
            href="/dashboard/profil?changePassword=1"
            className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
          >
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Initialpasswort ändern – jetzt im Profil ein eigenes Passwort vergeben →</span>
          </Link>
        )}
        {!employee && session.role === "MONTEUR" && (
          <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <span>Kein Mitarbeiterprofil verknüpft — Termine und Aufträge können nicht angezeigt werden. Bitte den Administrator kontaktieren.</span>
          </div>
        )}
        {children}
      </main>
      <Suspense fallback={null}>
        <MonteurBottomNav />
      </Suspense>
    </div>
    </SessionProvider>
  );
}
