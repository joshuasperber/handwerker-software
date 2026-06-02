import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessMonteurApp } from "@/lib/permissions";
import Link from "next/link";
import { Wrench, LogOut } from "lucide-react";
import { Suspense } from "react";
import { MonteurBottomNav } from "@/components/monteur/bottom-nav";
import { SessionProvider } from "@/components/auth/can-access";

export default async function MonteurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessMonteurApp(session.role)) redirect("/dashboard");

  return (
    <SessionProvider user={session}>
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
        <div className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-blue-600" />
          <span className="font-bold text-slate-900">Monteur</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{session.firstName}</span>
          {session.role !== "MONTEUR" && (
            <Link href="/dashboard" className="text-sm text-blue-600">Dashboard</Link>
          )}
          <form action="/api/auth/logout" method="POST">
            <button type="submit"><LogOut className="h-4 w-4 text-slate-400" /></button>
          </form>
        </div>
      </header>
      <main className="flex-1 p-4 pb-20">{children}</main>
      <Suspense fallback={null}>
        <MonteurBottomNav />
      </Suspense>
    </div>
    </SessionProvider>
  );
}
