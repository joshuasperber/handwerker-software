"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Search, X } from "lucide-react";
import {
  SEARCH_CATEGORY_META,
  type SearchCategory,
  type SearchGroup,
  type SearchResult,
} from "@/lib/search/types";
import { cn } from "@/lib/utils";

const DEBOUNCE_MS = 280;
const MIN_CHARS = 1;

export function DashboardSearch({ className }: { className?: string }) {
  const router = useRouter();
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestSeq = useRef(0);

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [activeCategory, setActiveCategory] = useState<SearchCategory | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [error, setError] = useState("");

  // Debounce – neuer Wert setzt immer debouncedQuery, auch bei Wiederholung
  useEffect(() => {
    const t = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [query]);

  const runSearch = useCallback(async (q: string) => {
    abortRef.current?.abort();
    const seq = ++requestSeq.current;

    if (q.length < MIN_CHARS) {
      setResult(null);
      setActiveCategory(null);
      setLoading(false);
      setError("");
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      if (seq !== requestSeq.current) return;
      if (!data.success) {
        setError(data.error ?? "Suche fehlgeschlagen");
        setResult(null);
        setActiveCategory(null);
        return;
      }
      const next = data.data as SearchResult;
      setResult(next);
      const preferred =
        next.topCategories[0] ??
        next.groups[0]?.category ??
        null;
      setActiveCategory(preferred);
      setMoreOpen(false);
    } catch (err) {
      if ((err as { name?: string })?.name === "AbortError") return;
      if (seq !== requestSeq.current) return;
      setError("Suche fehlgeschlagen");
      setResult(null);
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open && !debouncedQuery) return;
    void runSearch(debouncedQuery);
  }, [debouncedQuery, open, runSearch]);

  // Klick außerhalb schließt
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setMoreOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    setMoreOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setResult(null);
    setActiveCategory(null);
    router.push(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setMoreOpen(false);
      (e.target as HTMLInputElement).blur();
    }
    if (e.key === "Enter" && activeGroup?.hits[0]) {
      e.preventDefault();
      navigate(activeGroup.hits[0].href);
    }
  }

  const activeGroup: SearchGroup | undefined = result?.groups.find(
    (g) => g.category === activeCategory
  );
  const showPanel = open && (query.trim().length >= MIN_CHARS || loading || result);

  return (
    <div ref={rootRef} className={cn("relative w-full max-w-md", className)}>
      <label htmlFor={inputId} className="sr-only">
        Globale Suche
      </label>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Suchen: Aufträge, Kunden, Termine…"
        value={query}
        onChange={(e) => {
          const next = e.target.value;
          setQuery(next);
          setOpen(true);
          // Sofort stale Results ausblenden, wenn der Begriff sich ändert
          if (result && next.trim() !== result.query) {
            setResult(null);
            setActiveCategory(null);
          }
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d5c63]"
      />
      {query && (
        <button
          type="button"
          aria-label="Suche leeren"
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onClick={() => {
            abortRef.current?.abort();
            requestSeq.current += 1;
            setQuery("");
            setDebouncedQuery("");
            setResult(null);
            setActiveCategory(null);
            setLoading(false);
            setError("");
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showPanel && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 max-h-[min(70vh,28rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-2 py-1.5">
            {result?.topCategories.map((cat) => {
              const meta = SEARCH_CATEGORY_META[cat];
              const count =
                result.groups.find((g) => g.category === cat)?.hits.length ?? 0;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setActiveCategory(cat);
                    setMoreOpen(false);
                  }}
                  className={cn(
                    "shrink-0 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                    activeCategory === cat
                      ? "bg-[#0d5c63] text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  )}
                >
                  {meta.label}
                  <span className="ml-1 opacity-70">{count}</span>
                </button>
              );
            })}

            {(result?.moreCategories.length ?? 0) > 0 && (
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Weitere Bereiche"
                  onClick={() => setMoreOpen((v) => !v)}
                  className={cn(
                    "rounded-full p-1.5 text-slate-600 hover:bg-slate-100",
                    moreOpen && "bg-slate-200"
                  )}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full z-10 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white py-1 shadow-md">
                    {result!.moreCategories.map((cat) => {
                      const meta = SEARCH_CATEGORY_META[cat];
                      const count =
                        result!.groups.find((g) => g.category === cat)?.hits
                          .length ?? 0;
                      return (
                        <button
                          key={cat}
                          type="button"
                          className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm hover:bg-slate-50"
                          onClick={() => {
                            setActiveCategory(cat);
                            setMoreOpen(false);
                          }}
                        >
                          <span>{meta.label}</span>
                          <span className="text-xs text-slate-400">{count}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {loading && (
              <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-slate-400" />
            )}
          </div>

          <div className="max-h-72 overflow-y-auto overscroll-contain p-1">
            {error && (
              <p className="px-3 py-4 text-sm text-red-600">{error}</p>
            )}
            {!error && loading && !result && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                Suche läuft…
              </p>
            )}
            {!error && !loading && result && result.totalHits === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">
                Keine Treffer für „{result.query}“
              </p>
            )}
            {!error &&
              activeGroup &&
              activeGroup.hits.map((hit) => (
                <button
                  key={`${hit.category}-${hit.id}`}
                  type="button"
                  onClick={() => navigate(hit.href)}
                  className="flex w-full flex-col rounded-lg px-3 py-2 text-left hover:bg-slate-50 active:bg-slate-100"
                >
                  <span className="text-sm font-medium text-slate-900">
                    {hit.title}
                  </span>
                  {hit.subtitle && (
                    <span className="truncate text-xs text-slate-500">
                      {hit.subtitle}
                    </span>
                  )}
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
