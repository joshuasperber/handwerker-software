"use client";

import useSWR, { type SWRConfiguration } from "swr";
import { fetchJson } from "@/lib/fetch-json";

export const swrKeys = {
  orders: (qs = "") => `/api/orders${qs ? `?${qs}` : ""}`,
  customers: () => "/api/customers",
  employees: () => "/api/employees",
  articles: () => "/api/articles",
  stock: () => "/api/stock",
  storageLocations: () => "/api/storage-locations",
  stockMovements: (limit = 80) => `/api/stock/movements?limit=${limit}`,
  storageLocation: (id: string) => `/api/storage-locations/${id}`,
  dispositionAvailability: () => "/api/disposition/availability",
  dispositionUnassigned: () => "/api/disposition/unassigned",
  dashboardToday: () => "/api/dashboard/today",
  dashboardCritical: () => "/api/dashboard/critical",
  monteurSchedule: (date: string) => `/api/monteur/schedule?date=${date}`,
  timeEntries: (qs = "") => `/api/time-entries${qs ? `?${qs}` : ""}`,
  messagesUnreadCount: () => "/api/messages/unread-count",
  onboardingStatus: () => "/api/onboarding/status",
  tenantSettings: () => "/api/tenant/settings",
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
