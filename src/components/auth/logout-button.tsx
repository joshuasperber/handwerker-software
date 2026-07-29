"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

/** Ein Klick meldet ab und leert beide Session-Cookies zuverlässig. */
export function LogoutButton({
  className,
  label = "Abmelden",
  icon = true,
}: {
  className?: string;
  label?: string;
  icon?: boolean;
}) {
  const [pending, setPending] = useState(false);

  async function logout() {
    if (pending) return;
    setPending(true);
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
    } catch {
      // trotzdem zur Login-Seite
    }
    window.location.assign("/login");
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={pending}
      className={
        className ??
        "flex min-h-10 w-full items-center gap-2 rounded-lg px-3 text-sm text-slate-500 transition-colors hover:bg-slate-50 hover:text-red-600 disabled:opacity-60"
      }
    >
      {icon && <LogOut className="h-4 w-4" />}
      {pending ? "Abmelden…" : label}
    </button>
  );
}
