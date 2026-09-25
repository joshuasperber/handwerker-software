import { redirect } from "next/navigation";
import { getActiveSession } from "@/lib/auth";
import {
  canAccessWorkView,
  canSwitchAppViews,
  getRoleHomePath,
  prefersFieldHome,
} from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, PanelLeft } from "lucide-react";
import { Suspense } from "react";
import { MonteurBottomNav } from "@/components/monteur/bottom-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SessionProvider } from "@/components/auth/can-access";
import { LogoutButton } from "@/components/auth/logout-button";
import { ROLE_LABELS } from "@/lib/utils";
import { ViewSwitchLink } from "@/components/auth/view-switch-link";

export default async function MonteurLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getActiveSession();
  if (!session) redirect("/login");
  if (session.role === "KUNDE") redirect("/kunde");
  if (session.role === "GAST") redirect("/portal");
  if (!canAccessWorkView(session.role)) redirect(getRoleHomePath(session.role));

  const dbUser = await prisma.user.findFirst({
    where: { id: session.id, tenantId: session.tenantId },
    select: { canManageRoles: true },
  });
  const sessionWithFlags = {
    ...session,
    canManageRoles: dbUser?.canManageRoles ?? session.canManageRoles ?? false,
  };

  const employee = await prisma.employee.findFirst({
    where: { userId: session.id, tenantId: session.tenantId },
    select: { id: true },
  });

  const isFieldHome = prefersFieldHome(session.role);
  /** Nur Office mit Doppelzugriff — Monteure sehen keinen Verwaltungs-Button. */
  const showSwitch = canSwitchAppViews(session.role);

  return (
    <SessionProvider user={sessionWithFlags}>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white px-3 sm:px-4">
          <Link
            href="/monteur/heute"
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            <Image
              src="/icons/icon-192.png"
              alt="JoMaster"
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-lg"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-slate-900 sm:text-base">
                Arbeit
              </p>
              <p className="truncate text-[10px] uppercase tracking-wide text-slate-400">
                {ROLE_LABELS[session.role] ?? session.role}
              </p>
            </div>
          </Link>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <NotificationBell />
            {showSwitch && (
              <>
                <ViewSwitchLink
                  target="verwaltung"
                  label="Verwaltung"
                  className="hidden sm:inline text-sm font-medium text-[#0d5c63] hover:underline"
                />
                <ViewSwitchLink
                  target="verwaltung"
                  label={<PanelLeft className="h-4 w-4" aria-hidden />}
                  ariaLabel="Zur Verwaltung wechseln"
                  className="inline-flex sm:hidden h-9 w-9 items-center justify-center rounded-lg text-[#0d5c63] hover:bg-slate-100"
                />
              </>
            )}
            <span
              className="hidden max-w-[7rem] truncate text-sm text-slate-600 md:inline"
              title={`${session.firstName} ${session.lastName}`}
            >
              {session.firstName}
            </span>
            <LogoutButton
              label=""
              ariaLabel="Abmelden"
              icon
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-red-600 disabled:opacity-60"
            />
          </div>
        </header>
        <main className="flex-1 p-4 pb-24">
          {session.mustChangePassword && (
            <Link
              href="/monteur/profil?changePassword=1"
              className="mb-4 flex items-center gap-2.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>Initialpasswort ändern – jetzt im Profil ein eigenes Passwort vergeben →</span>
            </Link>
          )}
          {!employee && isFieldHome && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                Kein Mitarbeiterprofil verknüpft — Termine und Aufträge können nicht angezeigt
                werden. Bitte den Administrator kontaktieren.
              </span>
            </div>
          )}
          {!employee && !isFieldHome && (
            <div className="mb-4 flex items-center gap-2.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                Vorschau der Arbeitsansicht. Termine erscheinen nur mit verknüpftem
                Mitarbeiterprofil.{" "}
                <ViewSwitchLink target="verwaltung" label="Zur Verwaltung" className="font-medium underline" />
              </span>
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
