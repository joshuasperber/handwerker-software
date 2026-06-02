"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Calendar, Package, Users, MessageSquare, Clock, UserCircle, Warehouse,
} from "lucide-react";

const ITEMS = [
  { href: "/monteur", match: "monteur-home", label: "Mein Plan", icon: Calendar },
  { href: "/monteur/team", match: "team", label: "Team", icon: Users },
  { href: "/monteur?view=material", match: "material", label: "Material", icon: Package },
  { href: "/monteur/nachrichten", match: "nachrichten", label: "Nachrichten", icon: MessageSquare },
  { href: "/monteur/stundenzettel", match: "stundenzettel", label: "Stunden", icon: Clock },
  { href: "/dashboard/kunden", match: "kunden", label: "Kunden", icon: UserCircle },
  { href: "/dashboard/mitarbeiter", match: "mitarbeiter", label: "Team-Info", icon: Users },
  { href: "/dashboard/inventar", match: "inventar", label: "Lager", icon: Warehouse },
];

export function MonteurBottomNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");

  function isActive(item: (typeof ITEMS)[number]) {
    if (item.match === "monteur-home") {
      return pathname === "/monteur" && view !== "material";
    }
    if (item.match === "material") {
      return pathname === "/monteur" && view === "material";
    }
    if (item.match === "team") return pathname.startsWith("/monteur/team");
    if (item.match === "nachrichten") return pathname.startsWith("/monteur/nachrichten");
    if (item.match === "stundenzettel") return pathname.startsWith("/monteur/stundenzettel");
    return pathname.startsWith(item.href);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 bg-white">
      <div className="flex overflow-x-auto max-w-full scrollbar-hide">
        {ITEMS.map(({ href, match, label, icon: Icon }) => {
          const active = isActive({ href, match, label, icon: Icon });
          return (
            <Link
              key={match}
              href={href}
              className={`flex flex-col items-center justify-center py-2 px-3 text-[10px] font-medium min-h-[56px] min-w-[64px] shrink-0 transition-colors ${
                active ? "bg-slate-200 text-slate-900" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <Icon className="h-5 w-5 mb-0.5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
