"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { isNavItemActive } from "@/lib/dashboard-nav";

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
  const active = isNavItemActive(pathname, href);
  const showBadge = typeof badge === "number" && badge > 0;

  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-150 ${
        active
          ? "bg-white/12 text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
          : "text-white/62 hover:bg-white/7 hover:text-white"
      }`}
    >
      <span className="relative shrink-0">
        <Icon className={`h-[18px] w-[18px] transition-colors ${active ? "text-[#8bd3d7]" : "text-white/48 group-hover:text-white/80"}`} />
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
