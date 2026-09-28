import Image from "next/image";

import { cn } from "@/lib/utils";

export function AppLoadingScreen({
  label = "Arbeitsbereich wird vorbereitet",
  fullScreen = false,
}: {
  label?: string;
  fullScreen?: boolean;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden px-6",
        fullScreen ? "min-h-screen bg-[#f5f7f8]" : "min-h-[58vh]"
      )}
    >
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0b6268]/5 blur-3xl" aria-hidden />
      <div className="app-loading-reveal relative flex flex-col items-center text-center">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-[22px] bg-[#0b6268]/10 [animation-duration:1.8s] motion-reduce:animate-none" />
          <span className="relative flex h-16 w-16 items-center justify-center rounded-[22px] border border-white bg-white shadow-[0_16px_45px_rgba(11,98,104,0.16)]">
            <Image
              src="/icons/icon-192.png"
              alt=""
              width={44}
              height={44}
              priority
              className="h-11 w-11 rounded-[14px]"
            />
          </span>
        </div>
        <p className="mt-5 text-sm font-medium text-slate-700">{label}</p>
        <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0b6268] motion-reduce:animate-none"
              style={{ animationDelay: `${index * 160}ms` }}
            />
          ))}
        </div>
        <span className="sr-only">Bitte warten.</span>
      </div>
    </div>
  );
}
