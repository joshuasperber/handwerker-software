"use client";

import { SWRConfig } from "swr";
import type { ReactNode } from "react";
import { fetchJson } from "@/lib/fetch-json";

async function swrFetcher<T>(url: string): Promise<T> {
  const res = await fetchJson<T>(url);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error ?? "Laden fehlgeschlagen");
  }
  return res.data;
}

/**
 * Globales SWR: Deduplizierung + keepPreviousData für flüssigere Navigation.
 * Sensible Daten (Finanzen, Kunden, Mitarbeiter) nur im Speicher — kein Persistenz-Cache.
 * Finance-APIs liefern zusätzlich Cache-Control: private, no-store.
 */
export function SwrProvider({ children }: { children: ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: swrFetcher,
        revalidateOnFocus: true,
        dedupingInterval: 5_000,
        keepPreviousData: true,
        errorRetryCount: 2,
      }}
    >
      {children}
    </SWRConfig>
  );
}
