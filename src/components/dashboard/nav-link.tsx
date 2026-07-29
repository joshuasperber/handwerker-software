"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function DashboardNavLink({
  href,
  label,
  icon: Icon,
  onClick,
  badge,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  badge?: number;
}) {
  const pathname = usePathname();
  const active =
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname === href || pathname.startsWith(`${href}/`);
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex min-h-12 items-center gap-4 rounded-lg px-5 py-3 text-sm font-medium transition-colors ${
        active
          ? "bg-slate-200 text-slate-900"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <span className="relative shrink-0">
        <Icon className="h-5 w-5" />
        {showBadge && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-action px-1 text-[10px] font-bold text-white">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
      </span>
      {label}
    </Link>
  );
}
