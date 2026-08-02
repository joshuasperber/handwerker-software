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
    <nav className="fixed bottom-0 left-0 right-0 z-20 w-full border-t border-slate-200 bg-white safe-area-pb">
      <div className="grid w-full grid-cols-5">
        {ITEMS.map(({ href, match, label, icon: Icon }) => {
          const active = isActive(match, href);
          return (
            <Link
              key={match}
              href={href}
              className={`flex min-h-[56px] flex-col items-center justify-center px-0.5 py-2 text-[10px] font-medium transition-colors active:scale-[0.98] ${
                active ? "bg-[#0d5c63]/10 text-[#0d5c63]" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="mb-0.5 h-5 w-5 shrink-0" />
              <span className="max-w-full truncate">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
