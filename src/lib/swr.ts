"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { fetchJson } from "@/lib/fetch-json";

export const swrKeys = {
  orders: (qs = "") => `/api/orders${qs ? `?${qs}` : ""}`,
  customers: () => "/api/customers",
  employees: () => "/api/employees",
  articles: () => "/api/articles",
  stock: () => "/api/stock",
  monteurSchedule: (date: string) => `/api/monteur/schedule?date=${date}`,
} as const;

async function jsonFetcher<T>(url: string): Promise<T> {
  const res = await fetchJson<T>(url);
  if (!res.success || res.data === undefined) {
    throw new Error(res.error ?? "Laden fehlgeschlagen");
  }
  return res.data;
}

export function useApiSWR<T>(
  key: string | null,
  config?: SWRConfiguration<T>
) {
  return useSWR<T>(key, jsonFetcher, config);
}
