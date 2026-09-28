"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Share2, MessageSquare, Wrench } from "lucide-react";
import { LogoutButton } from "@/components/auth/logout-button";

const LINKS = [
  { href: "/portal", label: "Geteilt mit mir", icon: Share2 },
  { href: "/portal/nachrichten", label: "Nachrichten", icon: MessageSquare },
];

export function PortalNav({ name }: { name: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/92 shadow-[0_1px_14px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0b6268] text-white shadow-[0_8px_22px_rgba(11,98,104,0.2)]">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="truncate font-semibold tracking-tight text-slate-950">{name}</span>
        </div>
        <LogoutButton className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 disabled:opacity-60" />
      </div>
      <nav className="mx-auto flex max-w-3xl gap-1 px-4">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                active
                  ? "border-[#0b6268] text-[#0b6268]"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
