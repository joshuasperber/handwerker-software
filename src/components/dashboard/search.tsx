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
import { fetchJson } from "@/lib/fetch-json";
import { listControlClasses } from "@/components/ui/list-controls";

const DEBOUNCE_MS = 280;
const MIN_CHARS = 1;

export function DashboardSearch({
  className,
  collapsible = false,
  mobileOverlay = false,
}: {
  className?: string;
  collapsible?: boolean;
  mobileOverlay?: boolean;
}) {
  const router = useRouter();
  const inputId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
  const [expanded, setExpanded] = useState(!collapsible);

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
      const data = await fetchJson<SearchResult>(`/api/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (seq !== requestSeq.current) return;
      if (!data.success || !data.data) {
        setError(data.error ?? "Suche fehlgeschlagen");
        setResult(null);
        setActiveCategory(null);
        return;
      }
      const next = data.data;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Debounce/Öffnen startet den asynchronen Suchlauf.
    void runSearch(debouncedQuery);
  }, [debouncedQuery, open, runSearch]);

  // Klick außerhalb schließt
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setMoreOpen(false);
        if (collapsible) setExpanded(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [collapsible]);

  function navigate(href: string) {
    setOpen(false);
    setMoreOpen(false);
    setQuery("");
    setDebouncedQuery("");
    setResult(null);
    setActiveCategory(null);
    if (collapsible) setExpanded(false);
    router.push(href);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
      setMoreOpen(false);
      if (collapsible) setExpanded(false);
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

  function openSearch() {
    setExpanded(true);
    setOpen(true);
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  function clearSearch() {
    abortRef.current?.abort();
    requestSeq.current += 1;
    setQuery("");
    setDebouncedQuery("");
    setResult(null);
    setActiveCategory(null);
    setLoading(false);
    setError("");
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "relative shrink-0 transition-[width] duration-200 ease-out",
        collapsible
          ? expanded
            ? mobileOverlay
              ? "fixed left-3 right-14 top-2.5 z-40 w-auto sm:static sm:w-[min(28rem,48vw)]"
              : "w-[min(28rem,48vw)]"
            : "w-10"
          : "w-full max-w-md",
        className
      )}
    >
      {collapsible && !expanded ? (
        <button
          type="button"
          aria-label="Suche öffnen"
          title="Suche öffnen"
          onClick={openSearch}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/80 bg-slate-50 text-slate-500 shadow-sm transition-colors hover:border-[#0b6268]/25 hover:bg-white hover:text-[#0b6268] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b6268]/25"
        >
          <Search className="h-[18px] w-[18px]" />
        </button>
      ) : (
        <>
      <label htmlFor={inputId} className="sr-only">
        Globale Suche
      </label>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
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
        className={cn(listControlClasses, "w-full bg-white pl-10 pr-9 placeholder:text-slate-400")}
      />
      {(query || collapsible) && (
        <button
          type="button"
          aria-label={query ? "Suche leeren" : "Suche schließen"}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          onClick={() => {
            if (query) {
              clearSearch();
              inputRef.current?.focus();
              return;
            }
            setOpen(false);
            setExpanded(false);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      {showPanel && (
        <div className="absolute left-0 right-0 z-50 mt-2 max-h-[min(70vh,28rem)] overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_18px_55px_rgba(15,23,42,0.16)]">
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
        </>
      )}
    </div>
  );
}
