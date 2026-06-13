import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { canAccessCustomerPortal, getRoleHomePath } from "@/lib/permissions";
import { SessionProvider } from "@/components/auth/can-access";
import { LogOut, User } from "lucide-react";

export default async function KundeLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!canAccessCustomerPortal(session.role)) redirect(getRoleHomePath(session.role));

  return (
    <SessionProvider user={session}>
      <div className="min-h-screen bg-[#f8fafb]">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
            <div className="flex items-center gap-2 text-slate-900">
              <User className="h-5 w-5 text-[#0d5c63]" />
              <span className="font-semibold">Kundenbereich</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">{session.firstName}</span>
              <form action="/api/auth/logout" method="POST">
                <button type="submit" aria-label="Abmelden">
                  <LogOut className="h-4 w-4 text-slate-400" />
                </button>
              </form>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </div>
    </SessionProvider>
  );
}
