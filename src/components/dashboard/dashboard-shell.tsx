"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { AlertTriangle, ArrowRight, HardHat, Menu } from "lucide-react";
import { DashboardSearch } from "@/components/dashboard/search";
import { DashboardSidebarNav } from "@/components/dashboard/sidebar-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
import { ViewSwitchLink } from "@/components/auth/view-switch-link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

type DashboardSession = {
  firstName: string;
  lastName: string;
  role: string;
  avatarUrl?: string | null;
  mustChangePassword?: boolean;
};

type DashboardNavItem = {
  href: string;
  label: string;
  section?: import("@/lib/permissions").NavSection;
};

function BrandHomeLink({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  return (
    <Link
      href="/dashboard"
      onClick={onNavigate}
      aria-label="Zum Dashboard"
      title="Zum Dashboard"
      className={
        compact
          ? "truncate rounded-lg font-semibold tracking-tight text-slate-950 transition-colors hover:text-[#0b6268] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6268]/30"
          : "-ml-1 flex items-center gap-2.5 rounded-xl px-1 py-1 outline-none transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-white/30"
      }
    >
      {!compact && (
        <Image
          src="/icons/icon-192.png"
          alt="JoMaster Logo"
          width={32}
          height={32}
          className="h-8 w-8 rounded-[10px] shadow-[0_6px_18px_rgba(0,0,0,0.22)] ring-1 ring-white/15"
        />
      )}
      <span className={compact ? undefined : "font-semibold tracking-[-0.02em] text-white"}>
        JoMaster
      </span>
    </Link>
  );
}

function SidebarContent({
  navItems,
  session,
  roleLabel,
  canSwitchToWork,
  onNavigate,
}: {
  navItems: DashboardNavItem[];
  session: DashboardSession;
  roleLabel: string;
  canSwitchToWork: boolean;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-[72px] shrink-0 items-center border-b border-white/10 px-5">
        <BrandHomeLink onNavigate={onNavigate} />
      </div>
      <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-3.5 py-5">
        <DashboardSidebarNav items={navItems} onNavigate={onNavigate} />
      </nav>
      <div className="shrink-0 border-t border-white/10 px-4 pb-4 pt-3">
        {canSwitchToWork && (
          <div className="mb-3 border-b border-white/10 pb-3">
            <p className="mb-1.5 px-2 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/32">
              Ansicht
            </p>
            <ViewSwitchLink
              target="arbeit"
              ariaLabel="Zur Arbeitsansicht wechseln"
              label={
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-white/8 text-white/70 ring-1 ring-white/8 transition-colors group-hover:bg-[#e87722] group-hover:text-white">
                    <HardHat className="h-4.5 w-4.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-left">Arbeitsansicht</span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5 group-hover:text-white/60" aria-hidden />
                </>
              }
              className="group flex min-h-11 w-full items-center gap-2.5 rounded-xl px-2 text-sm font-medium text-white/70 no-underline transition-all duration-200 hover:bg-white/7 hover:text-white hover:no-underline"
            />
          </div>
        )}
        <Link
          href="/dashboard/profil"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-white/6"
        >
          {session.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.avatarUrl}
              alt=""
              className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white/15"
            />
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-xs font-semibold text-white ring-1 ring-white/10">
              {(session.firstName.charAt(0) + session.lastName.charAt(0)).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-white/90">
              {session.firstName} {session.lastName}
            </span>
            <span className="block text-[10px] uppercase tracking-[0.12em] text-white/45">
              {roleLabel}
            </span>
          </span>
        </Link>
        <LogoutButton className="flex min-h-10 w-full items-center gap-2 rounded-xl px-2 text-sm text-white/48 transition-colors hover:bg-white/6 hover:text-red-300 disabled:opacity-60" />
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-2 text-[10px] text-white/35">
          <Link href="/impressum" onClick={onNavigate} className="hover:text-white/75">
            Impressum
          </Link>
          <Link href="/datenschutz" onClick={onNavigate} className="hover:text-white/75">
            Datenschutz
          </Link>
          <Link href="/agb" onClick={onNavigate} className="hover:text-white/75">
            AGB
          </Link>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  children,
  navItems,
  session,
  roleLabel,
  canSwitchToWork,
}: {
  children: ReactNode;
  navItems: DashboardNavItem[];
  session: DashboardSession;
  roleLabel: string;
  /** Bewusster Wechsel zur Arbeitsansicht — nur bei Doppelzugriff. */
  canSwitchToWork: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f7f8]">
      <aside className="hidden h-full w-[272px] flex-shrink-0 flex-col border-r border-white/5 bg-[#0a2328] shadow-[12px_0_40px_rgba(7,28,33,0.08)] lg:flex">
        <SidebarContent
          navItems={navItems}
          session={session}
          roleLabel={roleLabel}
          canSwitchToWork={canSwitchToWork}
        />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="hidden h-[72px] items-center justify-between gap-5 border-b border-slate-200/80 bg-white/90 px-7 backdrop-blur-xl lg:flex">
          <DashboardSearch collapsible />
          <div className="flex shrink-0 items-center gap-3 text-sm text-slate-500">
            <span className="rounded-full border border-[#0b6268]/10 bg-[#0b6268]/7 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#0b6268]">
              Verwaltung
            </span>
            <span className="font-medium text-slate-700">
              {session.firstName} {session.lastName}
            </span>
            <NotificationBell />
          </div>
        </header>

        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-slate-200/80 bg-white/92 px-3 py-2.5 shadow-[0_1px_12px_rgba(15,23,42,0.04)] backdrop-blur-xl sm:px-5 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Navigation öffnen"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                  className="flex h-full w-80 max-w-[86vw] flex-col gap-0 border-white/10 bg-[#0a2328] p-0 text-white [&_[data-slot=sheet-close]]:text-white/70 [&_[data-slot=sheet-close]]:hover:bg-white/10"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <SidebarContent
                  navItems={navItems}
                  session={session}
                  roleLabel={roleLabel}
                  canSwitchToWork={canSwitchToWork}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <BrandHomeLink compact />
          </div>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <DashboardSearch collapsible mobileOverlay />
            <NotificationBell />
          </div>
        </header>

        <main className="app-main flex-1 overflow-auto px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-7">
          {session.mustChangePassword && (
            <Link
              href="/dashboard/profil?changePassword=1"
              className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 transition-colors hover:bg-amber-100"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              <span>
                <strong className="font-semibold">Passwort ändern erforderlich:</strong>{" "}
                Sie nutzen noch das Initialpasswort. Jetzt im Profil ein eigenes Passwort
                vergeben →
              </span>
            </Link>
          )}
          <div className="mx-auto w-full max-w-[1680px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
