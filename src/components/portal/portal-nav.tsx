"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Share2, MessageSquare, LogOut, Wrench } from "lucide-react";

const LINKS = [
  { href: "/portal", label: "Geteilt mit mir", icon: Share2 },
  { href: "/portal/nachrichten", label: "Nachrichten", icon: MessageSquare },
];

export function PortalNav({ name }: { name: string }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
      <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#0d5c63] text-white">
            <Wrench className="h-4 w-4" />
          </div>
          <span className="font-semibold text-slate-900 truncate">{name}</span>
        </div>
        <button
          type="button"
          onClick={logout}
          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" /> Abmelden
        </button>
      </div>
      <nav className="mx-auto max-w-3xl px-4 flex gap-1">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                active
                  ? "border-[#0d5c63] text-[#0d5c63]"
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
