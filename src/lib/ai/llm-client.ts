import type { AiChatResult, AiIntent, AiIntentType } from "./types";
import { parseDateFromText, parseDateRangeFromText } from "./intent-parser";

const SYSTEM_PROMPT = `Du bist ein Betriebsassistent für JoMaster (Handwerksbetriebs-Software).
Du darfst NUR die bereitgestellten App-Daten verwenden. Erfinde KEINE Kunden, Mitarbeiter, Aufträge, Termine, Rechnungen oder Materialien.
Wenn Daten fehlen, sage das klar. Gib keine verbindliche Steuer- oder Rechtsberatung.
Antworte auf Deutsch, strukturiert und sachlich.
WICHTIG: Die strukturierten App-Daten sind bereits die korrekte Antwort. Formuliere sie nur verständlicher um.
Erfinde keine Rückfragen wie „bitte formuliere um“, wenn bereits eine vollständige Liste oder Auskunft vorliegt.
Behalte alle Namen, Zahlen und Fakten exakt bei.`;

const GROQ_FALLBACK_MODEL = "openai/gpt-oss-20b";
const unavailableGroqModels = new Set<string>();

const INTENT_TYPES: AiIntentType[] = [
  "person_lookup",
  "list_employees",
  "list_customers",
  "employee_orders",
  "employee_materials",
  "order_search",
  "open_invoices",
  "missing_receipts",
  "profit_analysis",
  "material_shortage",
  "machine_usage",
  "appointment_schedule",
  "team_schedule",
  "help",
  "unknown",
];

function resolveLlmConfig() {
  const groqKey = process.env.GROQ_API_KEY?.trim();
  if (groqKey) {
    return {
      apiKey: groqKey,
      baseURL: process.env.GROQ_BASE_URL?.trim() || "https://api.groq.com/openai/v1",
      model: process.env.GROQ_MODEL?.trim() || GROQ_FALLBACK_MODEL,
      provider: "groq" as const,
    };
  }

  const openaiKey = process.env.OPENAI_API_KEY?.trim();
  if (openaiKey) {
    return {
      apiKey: openaiKey,
      baseURL: process.env.OPENAI_BASE_URL?.trim() || undefined,
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      provider: "openai" as const,
    };
  }

  return null;
}

async function createLlmClient() {
  const config = resolveLlmConfig();
  if (!config) return null;
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
    timeout: 6_000,
    maxRetries: 0,
  });
  return { client, config };
}

type LlmClient = NonNullable<Awaited<ReturnType<typeof createLlmClient>>>;

function isModelUnavailable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { status?: number; code?: string; error?: { code?: string } };
  return (
    candidate.status === 404 ||
    candidate.code === "model_not_found" ||
    candidate.error?.code === "model_not_found"
  );
}

async function withModelFallback<T>(
  llm: LlmClient,
  run: (model: string) => Promise<T>
): Promise<T> {
  const configuredModel = llm.config.model;
  const candidates =
    llm.config.provider === "groq" && configuredModel !== GROQ_FALLBACK_MODEL
      ? [configuredModel, GROQ_FALLBACK_MODEL]
      : [configuredModel];
  let lastError: unknown;

  for (const model of candidates) {
    if (unavailableGroqModels.has(model)) continue;
    try {
      return await run(model);
    } catch (error) {
      lastError = error;
      if (llm.config.provider !== "groq" || !isModelUnavailable(error)) throw error;
      unavailableGroqModels.add(model);
    }
  }

  throw lastError ?? new Error("Kein verfügbares KI-Modell konfiguriert.");
}

/**
 * Nutzt die KI, um unklare/umgangssprachliche Anfragen einem Intent zuzuordnen.
 * Die eigentlichen Daten kommen weiterhin nur aus der App-DB.
 */
export async function classifyIntentWithLlm(
  message: string,
  reference = new Date()
): Promise<AiIntent | null> {
  const llm = await createLlmClient();
  if (!llm) return null;

  try {
    const response = await withModelFallback(llm, (model) => llm.client.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `Du ordnest Nutzerfragen von JoMaster einem Intent zu.
Antworte NUR mit gültigem JSON, ohne Markdown, ohne Erklärung.

Erlaubte type-Werte:
${INTENT_TYPES.join(", ")}

JSON-Schema:
{"type":"...","personName":string|null,"searchTerm":string|null,"teamName":string|null,"dateHint":string|null}

Beispiele:
- "alle Mitarbeiter nennen" → {"type":"list_employees","personName":null,"searchTerm":null,"teamName":null,"dateHint":null}
- "zeig mir mal kurz die leute im team" → {"type":"list_employees",...}
- "wer ist Anton" → {"type":"person_lookup","personName":"Anton",...}
- "was braucht Max morgen" → {"type":"employee_materials","personName":"Max","dateHint":"morgen",...}
- "offene Rechnungen" → {"type":"open_invoices",...}
- "Termine morgen" → {"type":"appointment_schedule","dateHint":"morgen",...}
- "Aufträge mit Türen" → {"type":"order_search","searchTerm":"Türen",...}

Wenn unklar: type "unknown".`,
        },
        { role: "user", content: message },
      ],
    }));

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw) return null;

    const jsonText = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const parsed = JSON.parse(jsonText) as {
      type?: string;
      personName?: string | null;
      searchTerm?: string | null;
      teamName?: string | null;
      dateHint?: string | null;
    };

    if (!parsed.type || !INTENT_TYPES.includes(parsed.type as AiIntentType)) {
      return null;
    }

    const intent: AiIntent = {
      type: parsed.type as AiIntentType,
      rawMessage: message,
    };

    if (parsed.personName) intent.personName = parsed.personName;
    if (parsed.searchTerm) intent.searchTerm = parsed.searchTerm;
    if (parsed.teamName) intent.teamName = parsed.teamName;

    const hint = parsed.dateHint ?? message;
    const range = parseDateRangeFromText(hint, reference);
    const single = parseDateFromText(hint, reference);
    if (range) {
      intent.date = range.from;
      intent.dateEnd = range.to;
    } else if (single) {
      intent.date = single;
    }

    return intent;
  } catch (err) {
    console.error(`[ai] intent classification failed (${llm.config.provider}):`, err);
    return null;
  }
}

export async function enhanceWithLlm(
  userMessage: string,
  structuredResult: AiChatResult
): Promise<string | null> {
  // Bei unklaren Intents ohne Datenquellen keine LLM-„Höflichkeitsantwort“ erzeugen
  if (structuredResult.intent === "unknown" && structuredResult.dataSources.length === 0) {
    return null;
  }

  const llm = await createLlmClient();
  if (!llm) return null;

  try {
    const response = await withModelFallback(llm, (model) => llm.client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 1200,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Nutzerfrage: ${userMessage}

Strukturierte App-Daten (verbindlich, nichts hinzuerfinden):
${structuredResult.content}

Datenquellen: ${JSON.stringify(structuredResult.dataSources)}
Fehlende Daten: ${JSON.stringify(structuredResult.missingData ?? [])}

Formuliere eine verständliche Antwort. Behalte alle Fakten bei.
Wenn die App-Daten bereits eine Liste oder klare Auskunft enthalten, gib diese wieder — bitte nicht nach Umformulierung der Nutzerfrage fragen.`,
        },
      ],
    }));

    return response.choices[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.error(`[ai] LLM enhancement failed (${llm.config.provider}):`, err);
    return null;
  }
}
