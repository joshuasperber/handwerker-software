"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Calendar,
  Package,
  Users,
  User,
  MessageSquare,
  Clock,
} from "lucide-react";

const ITEMS = [
  { href: "/monteur/tagesplan", match: "tagesplan", label: "Tagesplan", icon: Calendar },
  { href: "/monteur/material", match: "material", label: "Material", icon: Package },
  { href: "/monteur/kunden", match: "kunden", label: "Kunden", icon: User },
  { href: "/monteur/mitarbeiter", match: "mitarbeiter", label: "Team", icon: Users },
  { href: "/monteur/stundenzettel", match: "stundenzettel", label: "Stunden", icon: Clock },
  { href: "/monteur/nachrichten", match: "nachrichten", label: "Nachrichten", icon: MessageSquare },
];

export function MonteurBottomNav() {
  const pathname = usePathname();

  function isActive(item: (typeof ITEMS)[number]) {
    if (item.match === "tagesplan") {
      return pathname === "/monteur/tagesplan" || pathname === "/monteur";
    }
    return pathname.startsWith(item.href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 w-full border-t border-slate-200 bg-white safe-area-pb">
      <div className="grid w-full grid-cols-6">
        {ITEMS.map(({ href, match, label, icon: Icon }) => {
          const active = isActive({ href, match, label, icon: Icon });
          return (
            <Link
              key={match}
              href={href}
              className={`flex min-h-[56px] flex-col items-center justify-center px-0.5 py-2 text-[10px] font-medium transition-colors ${
                active ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-50"
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
