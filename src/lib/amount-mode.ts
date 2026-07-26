"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Shared Brutto/Netto preference (localStorage). */
export type AmountMode = "gross" | "net";

const STORAGE_KEY = "jomaster-amount-mode";
const LEGACY_STORAGE_KEY = "handwerker-amount-mode";
const CHANGE_EVENT = "jomaster-amount-mode";
const DEFAULT_MODE: AmountMode = "gross";

function readMode(): AmountMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const v =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (v === "net" || v === "gross") {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        window.localStorage.setItem(STORAGE_KEY, v);
      }
      return v;
    }
    return DEFAULT_MODE;
  } catch {
    return DEFAULT_MODE;
  }
}

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {};
  const handler = (e: StorageEvent) => {
    if (
      e.key === STORAGE_KEY ||
      e.key === LEGACY_STORAGE_KEY ||
      e.key === null
    ) {
      onStoreChange();
    }
  };
  window.addEventListener("storage", handler);
  window.addEventListener(CHANGE_EVENT, onStoreChange as EventListener);
  return () => {
    window.removeEventListener("storage", handler);
    window.removeEventListener(CHANGE_EVENT, onStoreChange as EventListener);
  };
}

function getServerSnapshot(): AmountMode {
  return DEFAULT_MODE;
}

export function useAmountMode(): [AmountMode, (mode: AmountMode) => void] {
  const mode = useSyncExternalStore(subscribe, readMode, getServerSnapshot);
  const setMode = useCallback((next: AmountMode) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);
  return [mode, setMode];
}

export function pickAmount(
  mode: AmountMode,
  amounts: { net: number; gross: number }
): number {
  return mode === "net" ? amounts.net : amounts.gross;
}

export function amountModeLabel(mode: AmountMode): string {
  return mode === "net" ? "Netto" : "Brutto";
}
