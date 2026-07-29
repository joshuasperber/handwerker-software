"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, History, Loader2, MessageSquare, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { fetchJson } from "@/lib/fetch-json";
import { cn } from "@/lib/utils";
import type { AiMessageMetadata, PersonMatch } from "@/lib/ai/types";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  metadata?: AiMessageMetadata | null;
}

interface SessionSummary {
  id: string;
  title: string | null;
  updatedAt: string;
  preview: string;
}

const STARTER_PROMPTS = [
  "Zeig mir alle Mitarbeiter",
  "Zeig mir alle Kunden",
  "Welche Kunden haben offene Rechnungen?",
  "Aufträge mit Tür anbringen",
];

function renderMarkdownLite(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return (
        <em key={i} className="text-slate-500">
          {part.slice(1, -1)}
        </em>
      );
    }
    return part.split("\n").map((line, j, arr) => (
      <span key={`${i}-${j}`}>
        {line}
        {j < arr.length - 1 && <br />}
      </span>
    ));
  });
}

function formatSessionTime(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AssistantChat() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const [pendingDisambiguation, setPendingDisambiguation] = useState<{
    options: PersonMatch[];
    originalMessage: string;
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, []);

  const loadSessions = useCallback(async () => {
    const res = await fetchJson<SessionSummary[]>("/api/ai/sessions");
    if (res.success && res.data) {
      setSessions(res.data);
    }
  }, []);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading, scrollToBottom]);

  const loadSession = async (id: string) => {
    if (loading || loadingSession) return;
    setLoadingSession(true);
    setPendingDisambiguation(null);
    setHistoryOpen(false);

    const res = await fetchJson<{
      id: string;
      title: string | null;
      messages: Array<{
        id: string;
        role: string;
        content: string;
        metadata: AiMessageMetadata | null;
      }>;
    }>(`/api/ai/sessions/${id}`);

    setLoadingSession(false);

    if (!res.success || !res.data) return;

    setSessionId(res.data.id);
    setMessages(
      res.data.messages.map((m) => ({
        id: m.id,
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
        metadata: m.metadata,
      }))
    );
  };

  const sendMessage = async (
    text: string,
    disambiguation?: { choice: "employee" | "customer"; name: string }
  ) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setLoading(true);
    setPendingDisambiguation(null);

    const userMsg: ChatMessage = {
      id: `user-${crypto.randomUUID()}`,
      role: "user",
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const res = await fetchJson<{
      sessionId: string;
      content: string;
      intent: string;
      dataSources: Array<{ type: string; count: number; label: string }>;
      confidence: string;
      missingData?: string[];
      disambiguationOptions?: PersonMatch[];
    }>("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: disambiguation ? disambiguation.name : trimmed,
        sessionId: sessionId ?? undefined,
        disambiguationChoice: disambiguation?.choice,
        disambiguationName: disambiguation?.name,
      }),
    });

    setLoading(false);

    if (!res.success || !res.data) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${crypto.randomUUID()}`,
          role: "assistant",
          content: res.error ?? "Anfrage fehlgeschlagen.",
        },
      ]);
      return;
    }

    setSessionId(res.data.sessionId);

    if (res.data.disambiguationOptions?.length) {
      setPendingDisambiguation({
        options: res.data.disambiguationOptions,
        originalMessage: trimmed,
      });
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `asst-${crypto.randomUUID()}`,
        role: "assistant",
        content: res.data!.content,
        metadata: {
          intent: res.data!.intent as AiMessageMetadata["intent"],
          dataSources: res.data!.dataSources,
          confidence: res.data!.confidence as AiMessageMetadata["confidence"],
          missingData: res.data!.missingData,
        },
      },
    ]);

    void loadSessions();
  };

  const startNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setPendingDisambiguation(null);
    setInput("");
    setHistoryOpen(false);
    inputRef.current?.focus();
  };

  const deleteSession = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetchJson(`/api/ai/sessions/${id}`, { method: "DELETE" });
    if (sessionId === id) {
      setSessionId(null);
      setMessages([]);
    }
    void loadSessions();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-7rem)] sm:h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-6rem)]">
      <LoadingOverlay open={loading} label="Assistent antwortet …" />

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 sm:h-6 sm:w-6 text-[#0d5c63] shrink-0" />
            <span className="truncate">Betriebsassistent</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Antworten basieren nur auf App-Daten. KI-Antworten können Fehler enthalten und ersetzen
            keine Steuer-/Rechtsberatung. Details:{" "}
            <a href="/datenschutz" className="text-[#0d5c63] underline underline-offset-2">
              Datenschutz
            </a>
            .
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5 min-h-10"
            onClick={() => setHistoryOpen(true)}
          >
            <History className="h-4 w-4" />
            <span className="hidden xs:inline sm:inline">Chats</span>
            {sessions.length > 0 && (
              <span className="rounded-full bg-slate-100 px-1.5 text-[10px] font-semibold text-slate-600">
                {sessions.length}
              </span>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={startNewChat}
            className="gap-1 min-h-10"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Neu</span>
          </Button>
        </div>
      </div>

      <Sheet open={historyOpen} onOpenChange={setHistoryOpen}>
        <SheetContent side="right" className="w-[min(100%,22rem)] sm:max-w-sm p-0 flex flex-col">
          <SheetHeader className="border-b border-slate-100 px-4 py-4 text-left">
            <SheetTitle>Chat-Verlauf</SheetTitle>
            <SheetDescription>
              Vorherige Chats öffnen oder einen neuen starten.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            <Button
              type="button"
              variant="primary"
              className="w-full gap-2 min-h-11"
              onClick={startNewChat}
            >
              <Plus className="h-4 w-4" />
              Neuer Chat
            </Button>
            {sessions.length === 0 ? (
              <p className="text-sm text-slate-400 px-1 py-6 text-center">
                Noch keine gespeicherten Chats.
              </p>
            ) : (
              sessions.map((s) => (
                <div
                  key={s.id}
                  className={cn(
                    "group relative rounded-xl border transition-colors",
                    sessionId === s.id
                      ? "border-[#0d5c63]/40 bg-[#0d5c63]/5"
                      : "border-slate-200 bg-white"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => loadSession(s.id)}
                    className="w-full text-left px-3 py-3 pr-10 active:bg-slate-50 rounded-xl touch-manipulation"
                  >
                    <div className="flex items-start gap-2">
                      <MessageSquare className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {s.title || "Chat"}
                        </p>
                        {s.preview && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{s.preview}</p>
                        )}
                        <p className="text-[11px] text-slate-400 mt-1">
                          {formatSessionTime(s.updatedAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    aria-label="Chat löschen"
                    onClick={(e) => deleteSession(s.id, e)}
                    className="absolute top-2.5 right-2 p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-red-600 touch-manipulation"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Card className="flex flex-col flex-1 min-h-0 overflow-hidden !p-0">
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6 space-y-4">
          {loadingSession && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          )}

          {!loadingSession && messages.length === 0 && (
            <div className="text-center py-6 px-2 sm:py-8">
              <Bot className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-slate-300 mb-3" />
              <p className="text-slate-600 mb-5 max-w-md mx-auto text-sm">
                Stelle Fragen zu Kunden, Mitarbeitern, Aufträgen, Terminen, Material oder Finanzen.
              </p>
              <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 justify-center">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => sendMessage(prompt)}
                    className="text-sm px-3 py-3 sm:py-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 active:scale-[0.98] transition-[transform,background-color] touch-manipulation text-left sm:text-center"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2 sm:gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {msg.role === "assistant" && (
                <div className="shrink-0 w-8 h-8 rounded-full bg-[#0d5c63]/10 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-[#0d5c63]" />
                </div>
              )}
              <div
                className={`max-w-[90%] sm:max-w-[75%] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-[#0d5c63] text-white"
                    : "bg-slate-100 text-slate-800"
                }`}
              >
                <div className="whitespace-pre-wrap">{renderMarkdownLite(msg.content)}</div>
                {msg.metadata?.dataSources && msg.metadata.dataSources.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-slate-200/60 text-xs text-slate-500">
                    Quellen:{" "}
                    {msg.metadata.dataSources.map((s) => `${s.count} ${s.label}`).join(", ")}
                    {msg.metadata.confidence &&
                      ` · ${msg.metadata.confidence === "high" ? "Hohe" : msg.metadata.confidence === "medium" ? "Mittlere" : "Geringe"} Sicherheit`}
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="shrink-0 w-8 h-8 rounded-full bg-[#0d5c63]/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-[#0d5c63]" />
              </div>
              <div className="bg-slate-100 rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}

          {pendingDisambiguation && (
            <div className="flex flex-wrap gap-2 px-1">
              {pendingDisambiguation.options.map((opt) => (
                <Button
                  key={`${opt.type}-${opt.id}`}
                  variant="outline"
                  size="sm"
                  className="min-h-10"
                  onClick={() =>
                    sendMessage(pendingDisambiguation.originalMessage, {
                      choice: opt.type,
                      name: `${opt.firstName} ${opt.lastName}`,
                    })
                  }
                >
                  {opt.label}
                </Button>
              ))}
            </div>
          )}
        </div>

        <form
          onSubmit={handleSubmit}
          className="border-t border-slate-200 p-3 sm:p-4 flex gap-2 items-end bg-white safe-area-pb"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Frage stellen…"
            rows={1}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-base sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#0d5c63]/30 min-h-[48px] max-h-32"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 h-12 w-12 rounded-xl p-0"
            aria-label="Senden"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </Card>
    </div>
  );
}
