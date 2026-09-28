import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth";
import { canAccessCustomerPortal, getRoleHomePath } from "@/lib/permissions";
import { SessionProvider } from "@/components/auth/can-access";
import { LogoutButton } from "@/components/auth/logout-button";
import { User } from "lucide-react";

export default async function KundeLayout({ children }: { children: React.ReactNode }) {
  const session = await getActiveSession();
  if (!session) redirect("/login");
  if (!canAccessCustomerPortal(session.role)) redirect(getRoleHomePath(session.role));

  return (
    <SessionProvider user={session}>
      <div className="min-h-screen bg-[#f5f7f8]">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/92 shadow-[0_1px_14px_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4">
            <div className="flex items-center gap-2 text-slate-900">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b6268]/9 text-[#0b6268]">
                <User className="h-4.5 w-4.5" />
              </span>
              <span className="font-semibold tracking-tight">Kundenbereich</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{session.firstName}</span>
              <LogoutButton
                label=""
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-red-600 disabled:opacity-60"
              />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">{children}</main>
      </div>
    </SessionProvider>
  );
}
