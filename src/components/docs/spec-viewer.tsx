"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ChevronUp, BookOpen } from "lucide-react";
import type { SpecBlock, SpecDocument, SpecSection } from "@/data/spec-betriebssystem-v1";

function ResponsiveTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <>
      <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              {headers.map((h) => (
                <th key={h} className="text-left px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/80">
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-3 text-slate-600 align-top">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="md:hidden space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            {headers.map((h, j) => (
              <div key={h}>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{h}</p>
                <p className="text-sm text-slate-700 mt-0.5">{row[j] ?? "—"}</p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function AmpelBadge({ color, label }: { color: "green" | "yellow" | "red" | "gray"; label: string }) {
  const styles = {
    green: "bg-emerald-100 text-emerald-800 border-emerald-200",
    yellow: "bg-amber-100 text-amber-800 border-amber-200",
    red: "bg-red-100 text-red-800 border-red-200",
    gray: "bg-slate-100 text-slate-600 border-slate-200",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles[color]}`}>
      <span className={`h-2 w-2 rounded-full ${color === "green" ? "bg-emerald-500" : color === "yellow" ? "bg-amber-500" : color === "red" ? "bg-red-500" : "bg-slate-400"}`} />
      {label}
    </span>
  );
}

function BlockRenderer({ block }: { block: SpecBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="text-slate-600 leading-relaxed">{block.text}</p>;
    case "lead":
      return <p className="text-lg text-slate-700 leading-relaxed font-medium">{block.text}</p>;
    case "callout":
      return (
        <div className={`rounded-xl border-l-4 p-4 text-sm ${
          block.variant === "decision"
            ? "border-[#0d5c63] bg-[#0d5c63]/5 text-slate-700"
            : block.variant === "warning"
              ? "border-amber-500 bg-amber-50 text-amber-900"
              : "border-[#e87722] bg-orange-50 text-slate-700"
        }`}>
          {block.title && <p className="font-semibold mb-1">{block.title}</p>}
          <p className="leading-relaxed">{block.text}</p>
        </div>
      );
    case "list":
      return (
        <ol className={block.ordered ? "list-decimal list-inside space-y-2 text-slate-600" : "list-disc list-inside space-y-2 text-slate-600"}>
          {block.items.map((item, i) => (
            <li key={i} className="leading-relaxed">{item}</li>
          ))}
        </ol>
      );
    case "table":
      return <ResponsiveTable headers={block.headers} rows={block.rows} />;
    case "ampel":
      return (
        <div className="flex flex-wrap gap-2">
          {block.items.map((item) => (
            <AmpelBadge key={item.label} color={item.color} label={item.label} />
          ))}
        </div>
      );
    case "cards":
      return (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {block.items.map((card) => (
            <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-[#0d5c63]/30 transition-colors">
              <h4 className="font-semibold text-slate-900 text-sm">{card.title}</h4>
              {card.subtitle && <p className="text-xs text-[#0d5c63] mt-1 font-medium">{card.subtitle}</p>}
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">{card.body}</p>
            </div>
          ))}
        </div>
      );
    case "checklist":
      return (
        <ul className="space-y-2">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-slate-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#0d5c63]/10 text-[#0d5c63] text-xs font-bold">
                {i + 1}
              </span>
              <span className="pt-0.5 leading-relaxed">{item}</span>
            </li>
          ))}
        </ul>
      );
    default:
      return null;
  }
}

function SectionContent({ section }: { section: SpecSection }) {
  return (
    <section id={section.id} className="scroll-mt-24">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#e87722]">{section.number}</p>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">{section.title}</h2>
        {section.subtitle && <p className="text-slate-500 mt-2 text-sm sm:text-base">{section.subtitle}</p>}
      </div>
      <div className="space-y-5">
        {section.blocks.map((block, i) => (
          <BlockRenderer key={i} block={block} />
        ))}
      </div>
    </section>
  );
}

export function SpecViewer({ doc }: { doc: SpecDocument }) {
  const [navOpen, setNavOpen] = useState(false);
  const [activeId, setActiveId] = useState(doc.sections[0]?.id ?? "");

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-20% 0px -60% 0px", threshold: [0, 0.25, 0.5] }
    );
    doc.sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [doc.sections]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 text-[#0d5c63] shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{doc.title}</p>
              <p className="text-xs text-slate-400 hidden sm:block">v{doc.version} · {doc.type}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            className="lg:hidden flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700"
          >
            <Menu className="h-4 w-4" /> Inhalt
          </button>
          <Link href="/" className="hidden sm:inline text-sm text-[#0d5c63] hover:underline shrink-0">
            Zur App
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 lg:py-10">
        <div className="lg:grid lg:grid-cols-[240px_1fr] xl:grid-cols-[260px_1fr] lg:gap-10">
          <aside className="hidden lg:block">
            <nav className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 space-y-0.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3 px-2">Kapitel</p>
              {doc.sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors ${
                    activeId === s.id
                      ? "bg-[#0d5c63] text-white font-medium"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="text-xs opacity-70 mr-1">{s.number}</span>
                  {s.navTitle ?? s.title}
                </a>
              ))}
            </nav>
          </aside>

          <main className="min-w-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-8 mb-8 shadow-sm">
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">{doc.type}</span>
                <span className="rounded-full bg-[#0d5c63]/10 px-3 py-1 text-xs font-medium text-[#0d5c63]">Version {doc.version}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 leading-tight">{doc.title}</h1>
              <p className="text-slate-500 mt-3 text-sm sm:text-base">{doc.subtitle}</p>
              <div className="mt-6 rounded-xl bg-slate-50 p-4 grid gap-3 sm:grid-cols-3 text-sm">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Dokumenttyp</p>
                  <p className="text-slate-700 mt-1">{doc.meta.documentType}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Version</p>
                  <p className="text-slate-700 mt-1">{doc.version}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold">Ziel</p>
                  <p className="text-slate-700 mt-1">{doc.meta.goal}</p>
                </div>
              </div>
              <div className="mt-6">
                <BlockRenderer block={doc.leadCallout} />
              </div>
            </div>

            <div className="space-y-12 sm:space-y-16">
              {doc.sections.map((section) => (
                <SectionContent key={section.id} section={section} />
              ))}
            </div>

            <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-sm text-slate-400 pb-24 lg:pb-8">
              {doc.title} · Version {doc.version}
            </footer>
          </main>
        </div>
      </div>

      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-black/40" onClick={() => setNavOpen(false)} aria-label="Schließen" />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
              <p className="font-semibold text-slate-900">Inhaltsverzeichnis</p>
              <button type="button" onClick={() => setNavOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="overflow-y-auto p-4 space-y-1 flex-1">
              {doc.sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  onClick={() => setNavOpen(false)}
                  className="block rounded-lg px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 border border-transparent hover:border-slate-100"
                >
                  <span className="text-[#e87722] font-semibold text-xs">{s.number}</span>
                  <span className="block mt-0.5 font-medium">{s.title}</span>
                </a>
              ))}
            </nav>
          </div>
        </div>
      )}

      <div className="lg:hidden fixed bottom-4 left-4 right-4 z-30">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0d5c63] text-white py-3.5 text-sm font-semibold shadow-lg"
        >
          <Menu className="h-4 w-4" /> Kapitel wählen
        </button>
      </div>

      <a
        href="#"
        className="hidden sm:flex fixed bottom-6 right-6 z-30 h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200 shadow-md text-slate-600 hover:text-[#0d5c63]"
        aria-label="Nach oben"
        onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
      >
        <ChevronUp className="h-5 w-5" />
      </a>
    </div>
  );
}
