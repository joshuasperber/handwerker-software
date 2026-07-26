"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, Loader2, MessageSquare, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
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
      setSessions(res.data.slice(0, 3));
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
      id: `user-${Date.now()}`,
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
          id: `err-${Date.now()}`,
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
        id: `asst-${Date.now()}`,
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
    // Alten Chat behalten (Historie) — nur UI zurücksetzen
    setSessionId(null);
    setMessages([]);
    setPendingDisambiguation(null);
    setInput("");
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
    <div className="flex flex-col h-[calc(100dvh-8rem)] lg:h-[calc(100dvh-6rem)]">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-[#0d5c63]" />
            Betriebsassistent
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Antworten basieren nur auf deinen App-Daten — nichts wird erfunden.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={startNewChat} className="shrink-0">
          <Plus className="h-4 w-4 mr-1" />
          Neuer Chat
        </Button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
        <aside className="lg:w-64 shrink-0 flex flex-col gap-2">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide px-1">
            Letzte Chats
          </p>
          {sessions.length === 0 ? (
            <p className="text-xs text-slate-400 px-1 py-2">Noch keine gespeicherten Chats.</p>
          ) : (
            sessions.map((s) => (
              <div
                key={s.id}
                className={cn(
                  "group relative rounded-xl border transition-colors",
                  sessionId === s.id
                    ? "border-[#0d5c63]/40 bg-[#0d5c63]/5"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                )}
              >
                <button
                  type="button"
                  onClick={() => loadSession(s.id)}
                  className="w-full text-left px-3 py-2.5 pr-10"
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="h-3.5 w-3.5 mt-0.5 text-slate-400 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {s.title || "Chat"}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {formatSessionTime(s.updatedAt)}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  aria-label="Chat löschen"
                  onClick={(e) => deleteSession(s.id, e)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-red-600 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </aside>

        <Card className="flex flex-col flex-1 min-h-0 overflow-hidden p-0">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 space-y-4">
            {loadingSession && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              </div>
            )}

            {!loadingSession && messages.length === 0 && (
              <div className="text-center py-8 px-4">
                <Bot className="h-12 w-12 mx-auto text-slate-300 mb-4" />
                <p className="text-slate-600 mb-6 max-w-md mx-auto">
                  Stelle Fragen zu Kunden, Mitarbeitern, Aufträgen, Terminen, Material oder Finanzen.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {STARTER_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => sendMessage(prompt)}
                      className="text-sm px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 transition-colors"
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
                className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="shrink-0 w-8 h-8 rounded-full bg-[#0d5c63]/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-[#0d5c63]" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
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
              <div className="flex flex-wrap gap-2 px-2">
                {pendingDisambiguation.options.map((opt) => (
                  <Button
                    key={`${opt.type}-${opt.id}`}
                    variant="outline"
                    size="sm"
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
            className="border-t border-slate-200 p-3 sm:p-4 flex gap-2 items-end bg-white"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Frage stellen…"
              rows={1}
              className="flex-1 resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0d5c63]/30 min-h-[48px] max-h-32"
              disabled={loading}
            />
            <Button
              type="submit"
              disabled={loading || !input.trim()}
              className="shrink-0 h-12 w-12 rounded-xl p-0"
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </Card>
      </div>

      <p className="text-xs text-slate-400 mt-2 text-center">
        Die letzten 3 Chats bleiben erhalten. Einzelne Chats kannst du über das Papierkorb-Symbol löschen.
      </p>
    </div>
  );
}
