"use client";

import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Mobilfreundlicher Navigations-Button statt „Text →“. */
export function NavActionCard({
  href,
  title,
  description,
  icon: Icon,
  className,
}: {
  href: string;
  title: string;
  description?: string;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5",
        "shadow-sm transition-[transform,background-color,box-shadow] duration-150",
        "hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] active:bg-slate-100",
        "touch-manipulation min-h-12",
        className
      )}
    >
      {Icon && (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#0d5c63]/10 text-[#0d5c63]">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-900">{title}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-slate-500">{description}</span>
        )}
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-400 group-hover:text-[#0d5c63]" />
    </Link>
  );
}
