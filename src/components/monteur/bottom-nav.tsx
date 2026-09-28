"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  CalendarDays,
  ClipboardList,
  Clock,
  Bot,
  MoreHorizontal,
} from "lucide-react";

const ITEMS = [
  { href: "/monteur/heute", match: "heute", label: "Heute", icon: CalendarDays },
  { href: "/monteur/auftraege", match: "auftraege", label: "Aufträge", icon: ClipboardList },
  { href: "/monteur/zeiten", match: "zeiten", label: "Zeiten", icon: Clock },
  { href: "/monteur/assistent", match: "assistent", label: "Assistent", icon: Bot },
  { href: "/monteur/mehr", match: "mehr", label: "Mehr", icon: MoreHorizontal },
] as const;

export function MonteurBottomNav() {
  const pathname = usePathname();

  function isActive(match: string, href: string) {
    if (match === "heute") {
      return (
        pathname === "/monteur/heute" ||
        pathname === "/monteur" ||
        pathname.startsWith("/monteur/tagesplan")
      );
    }
    if (match === "zeiten") {
      return pathname.startsWith("/monteur/zeiten") || pathname.startsWith("/monteur/stundenzettel");
    }
    if (match === "auftraege") {
      return pathname.startsWith("/monteur/auftraege") || pathname.startsWith("/monteur/auftrag");
    }
    return pathname.startsWith(href);
  }

  return (
    <nav className="safe-area-pb fixed bottom-2 left-1/2 z-30 w-[calc(100%-1rem)] max-w-2xl -translate-x-1/2 overflow-hidden rounded-2xl border border-white/80 bg-white/94 shadow-[0_14px_45px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:bottom-3 sm:w-[calc(100%-2rem)]">
      <div className="grid w-full grid-cols-5 px-1 py-1">
        {ITEMS.map(({ href, match, label, icon: Icon }) => {
          const active = isActive(match, href);
          return (
            <Link
              key={match}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`group flex min-h-[58px] flex-col items-center justify-center rounded-xl px-0.5 py-1.5 text-[10px] font-medium transition-all active:scale-[0.97] ${
                active ? "text-[#0b6268]" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className={`mb-0.5 flex h-7 min-w-9 items-center justify-center rounded-full transition-colors ${active ? "bg-[#0b6268]/10" : "group-hover:bg-slate-100"}`}>
                <Icon className="h-[19px] w-[19px] shrink-0" />
              </span>
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
