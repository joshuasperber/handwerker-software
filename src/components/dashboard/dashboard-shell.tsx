"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { AlertTriangle, Menu, Wrench } from "lucide-react";
import { DashboardSearch } from "@/components/dashboard/search";
import { DashboardSidebarNav } from "@/components/dashboard/sidebar-nav";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/auth/logout-button";
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
          ? "truncate font-bold text-slate-900 transition-colors hover:text-[#0d5c63] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0d5c63]/40 rounded"
          : "flex items-center gap-2 rounded-lg outline-none transition-colors hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-[#0d5c63]/40 -ml-1 px-1 py-1"
      }
    >
      {!compact && (
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0d5c63] text-white">
          <Wrench className="h-4 w-4" />
        </span>
      )}
      <span className={compact ? undefined : "font-bold text-slate-900"}>JoMaster</span>
    </Link>
  );
}

function SidebarContent({
  navItems,
  session,
  roleLabel,
  onNavigate,
}: {
  navItems: DashboardNavItem[];
  session: DashboardSession;
  roleLabel: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-5">
        <BrandHomeLink onNavigate={onNavigate} />
      </div>
      <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain px-5 py-5">
        <DashboardSidebarNav items={navItems} onNavigate={onNavigate} />
      </nav>
      <div className="shrink-0 border-t border-slate-100 px-5 py-4">
        <Link
          href="/dashboard/profil"
          onClick={onNavigate}
          className="mb-2 flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-slate-50"
        >
          {session.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={session.avatarUrl}
              alt=""
              className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
            />
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#0d5c63] text-xs font-semibold text-white">
              {(session.firstName.charAt(0) + session.lastName.charAt(0)).toUpperCase()}
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-xs font-medium text-slate-600">
              {session.firstName} {session.lastName}
            </span>
            <span className="block text-[10px] uppercase tracking-wide text-slate-400">
              {roleLabel}
            </span>
          </span>
        </Link>
        <LogoutButton />
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 px-1 text-[10px] text-slate-400">
          <Link href="/impressum" onClick={onNavigate} className="hover:text-[#0d5c63]">
            Impressum
          </Link>
          <Link href="/datenschutz" onClick={onNavigate} className="hover:text-[#0d5c63]">
            Datenschutz
          </Link>
          <Link href="/agb" onClick={onNavigate} className="hover:text-[#0d5c63]">
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
  canAccessMonteur,
}: {
  children: ReactNode;
  navItems: DashboardNavItem[];
  session: DashboardSession;
  roleLabel: string;
  canAccessMonteur: boolean;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <aside className="hidden h-full w-64 flex-shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent navItems={navItems} session={session} roleLabel={roleLabel} />
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="hidden h-14 items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 lg:flex">
          <DashboardSearch className="max-w-lg flex-1" />
          <div className="flex shrink-0 items-center gap-4 text-sm text-slate-500">
            {canAccessMonteur && (
              <Link href="/monteur" className="text-[#0d5c63] hover:underline">
                Monteur-App
              </Link>
            )}
            <NotificationBell />
            <span>
              {session.firstName} {session.lastName}
            </span>
          </div>
        </header>

        <header className="flex h-16 items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 sm:px-6 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
              <SheetTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Navigation öffnen"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="flex h-full w-80 max-w-[86vw] flex-col gap-0 bg-white p-0"
              >
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                <SidebarContent
                  navItems={navItems}
                  session={session}
                  roleLabel={roleLabel}
                  onNavigate={() => setMobileNavOpen(false)}
                />
              </SheetContent>
            </Sheet>
            <BrandHomeLink compact />
          </div>
          <DashboardSearch className="min-w-0 flex-1" />
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell />
            {canAccessMonteur && (
              <Link href="/monteur" className="shrink-0 text-sm text-[#0d5c63]">
                Monteur
              </Link>
            )}
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6">
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
          {children}
        </main>
      </div>
    </div>
  );
}
