import {
  addDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  addWeeks,
  setMonth,
  setDate,
} from "date-fns";
import type { AiIntent, AiIntentType } from "./types";

const MONTHS: Record<string, number> = {
  januar: 0,
  februar: 1,
  märz: 2,
  maerz: 2,
  april: 3,
  mai: 4,
  juni: 5,
  juli: 6,
  august: 7,
  september: 8,
  oktober: 9,
  november: 10,
  dezember: 11,
};

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function parseDateFromText(text: string, reference = new Date()): Date | undefined {
  const t = normalize(text);

  if (/\bheute\b/.test(t)) return startOfDay(reference);
  if (/\bmorgen\b/.test(t)) return startOfDay(addDays(reference, 1));
  if (/\bübermorgen\b|\buebermorgen\b/.test(t)) return startOfDay(addDays(reference, 2));

  const dmMatch = t.match(/(\d{1,2})\.\s*(\d{1,2})(?:\.|\s|$)/);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const month = Number(dmMatch[2]) - 1;
    return startOfDay(setDate(setMonth(reference, month), day));
  }

  const dMonthMatch = t.match(/(\d{1,2})\.?\s+(januar|februar|märz|maerz|april|mai|juni|juli|august|september|oktober|november|dezember)/);
  if (dMonthMatch) {
    const day = Number(dMonthMatch[1]);
    const month = MONTHS[dMonthMatch[2]];
    return startOfDay(setDate(setMonth(reference, month), day));
  }

  return undefined;
}

export function parseDateRangeFromText(
  text: string,
  reference = new Date()
): { from: Date; to: Date } | undefined {
  const t = normalize(text);

  if (/\bnächste woche\b|\bnachste woche\b/.test(t)) {
    const nextWeekStart = startOfWeek(addWeeks(reference, 1), { weekStartsOn: 1 });
    return { from: nextWeekStart, to: endOfWeek(nextWeekStart, { weekStartsOn: 1 }) };
  }

  if (/\bdiese woche\b|\baktuelle woche\b/.test(t)) {
    const weekStart = startOfWeek(reference, { weekStartsOn: 1 });
    return { from: weekStart, to: endOfWeek(weekStart, { weekStartsOn: 1 }) };
  }

  const single = parseDateFromText(text, reference);
  if (single) {
    return { from: startOfDay(single), to: endOfDay(single) };
  }

  if (/\bdiesen monat\b|\bdiesem monat\b/.test(t)) {
    const from = new Date(reference.getFullYear(), reference.getMonth(), 1);
    const to = endOfDay(new Date(reference.getFullYear(), reference.getMonth() + 1, 0));
    return { from, to };
  }

  return undefined;
}

const LIST_OR_STOPWORDS =
  /^(alle|offene|fehlende|welche|was|warum|team|mitarbeiter|mitarbeitern|kunden|auftr[aä]ge|termine|belege|maschinen|materialien)\b/i;

function isListStylePhrase(text: string): boolean {
  const t = normalize(text);
  return (
    /\balle\s+mitarbeiter/.test(t) ||
    /\balle\s+kunden/.test(t) ||
    /\bmitarbeiter\s*(nennen|auflisten|zeigen|liste)/.test(t) ||
    /\bkunden\s*(nennen|auflisten|zeigen|liste)/.test(t) ||
    /\b(liste|auflisten|nennen)\s+(der\s+|alle\s+)?mitarbeiter/.test(t) ||
    /\b(liste|auflisten|nennen)\s+(der\s+|alle\s+)?kunden/.test(t) ||
    /\bwelche\s+mitarbeiter\b/.test(t) ||
    /\bwelche\s+kunden\b(?!.*rechnung)/.test(t)
  );
}

function extractPersonName(text: string): string | undefined {
  if (isListStylePhrase(text)) return undefined;

  const patterns = [
    /was muss (.+?) am \d/i,
    /was muss (.+?) morgen/i,
    /was muss (.+?) heute/i,
    /welche auftr[aä]ge hat (.+?) am/i,
    /welche termine hat (.+?) am/i,
    /welche termine hat (.+?) morgen/i,
    /termine (?:von |für )?(.+?) am/i,
    /termine (?:von |für )?(.+?) morgen/i,
    /(?:zeig mir|daten zu|informationen zu|wer ist)\s+(.+?)(?:\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const name = match[1].trim().replace(/[?.!"']+$/g, "");
      if (
        name.length >= 2 &&
        !LIST_OR_STOPWORDS.test(name) &&
        !/\s+(nennen|auflisten|zeigen|liste)\s*$/i.test(name)
      ) {
        return name;
      }
    }
  }

  // Nur reine Namen ohne Satzbefehl (z. B. „Anton“ oder „Max Müller“)
  const bare = text.trim().replace(/[?.!"']+$/g, "");
  if (/^[\wäöüßÄÖÜ-]+(?:\s+[\wäöüßÄÖÜ-]+)?$/i.test(bare) && !LIST_OR_STOPWORDS.test(bare)) {
    return bare;
  }

  return undefined;
}

function extractSearchTerm(text: string): string | undefined {
  const patterns = [
    /auftr[aä]ge(?: mit| für| zum)?\s+(.+?)(?:\.|$)/i,
    /alle auftr[aä]ge mit\s+(.+?)(?:\.|$)/i,
    /suche(?: nach)?\s+(.+?)(?:\.|$)/i,
    /material f[uü]r auftrag\s+(.+?)(?:\.|$)/i,
    /montage\s+(.+?)(?:\.|$)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      return match[1].trim().replace(/[?.!]+$/, "");
    }
  }
  return undefined;
}

function extractTeamName(text: string): string | undefined {
  const match = text.match(/team\s+(\d+|[\wäöüß-]+)/i);
  return match?.[1]?.trim();
}

export function parseIntent(message: string, reference = new Date()): AiIntent {
  const raw = message.trim();
  const t = normalize(raw);

  if (!raw) {
    return { type: "unknown", rawMessage: raw };
  }

  if (/^(hilfe|help|was kannst du|beispiele)/.test(t)) {
    return { type: "help", rawMessage: raw };
  }

  // Listen vor Personensuche — sonst wird „Zeig mir alle Mitarbeiter“ als Name missverstanden
  if (
    /\balle\s+mitarbeiter/.test(t) ||
    /\bmitarbeiter\s*(nennen|auflisten|zeigen|liste)/.test(t) ||
    /\b(liste|auflisten|nennen)\s+(der\s+|alle\s+)?mitarbeiter/.test(t) ||
    /\bzeig\s+mir\s+(alle\s+)?mitarbeiter/.test(t) ||
    /\bwelche\s+mitarbeiter\b/.test(t) ||
    /^mitarbeiter$/.test(t)
  ) {
    return { type: "list_employees", rawMessage: raw };
  }

  if (
    (/\balle\s+kunden/.test(t) ||
      /\bkunden\s*(nennen|auflisten|zeigen|liste)/.test(t) ||
      /\b(liste|auflisten|nennen)\s+(der\s+|alle\s+)?kunden/.test(t) ||
      /\bzeig\s+mir\s+(alle\s+)?kunden/.test(t) ||
      /\bwelche\s+kunden\b/.test(t) ||
      /^kunden$/.test(t)) &&
    !/rechnung/.test(t)
  ) {
    return { type: "list_customers", rawMessage: raw };
  }

  if (/offene rechnung|kunden mit offenen rechnungen|unbezahlte rechnung/.test(t)) {
    return { type: "open_invoices", rawMessage: raw };
  }

  if (/belege? fehlen|fehlende belege|belege diesen monat/.test(t)) {
    const range = parseDateRangeFromText(t, reference);
    return {
      type: "missing_receipts",
      rawMessage: raw,
      date: range?.from,
      dateEnd: range?.to,
    };
  }

  if (/gewinn|profit|einnahmen.*hoch|warum.*hoch/.test(t)) {
    return { type: "profit_analysis", rawMessage: raw };
  }

  if (/material.*fehl|material.*knapp|material.*n[aä]chste woche|nachbestell/.test(t)) {
    const range = parseDateRangeFromText(t, reference) ?? {
      from: startOfWeek(reference, { weekStartsOn: 1 }),
      to: endOfWeek(addWeeks(reference, 1), { weekStartsOn: 1 }),
    };
    return {
      type: "material_shortage",
      rawMessage: raw,
      date: range.from,
      dateEnd: range.to,
    };
  }

  if (/maschine.*einsatz|maschinen.*einsatz|lange im einsatz|maschine.*wartung/.test(t)) {
    return { type: "machine_usage", rawMessage: raw };
  }

  if (/termine.*team|team.*termine|team.*morgen|team.*heute/.test(t)) {
    const teamName = extractTeamName(raw);
    const range = parseDateRangeFromText(t, reference) ?? {
      from: startOfDay(addDays(reference, 1)),
      to: endOfDay(addDays(reference, 1)),
    };
    return {
      type: "team_schedule",
      teamName,
      rawMessage: raw,
      date: range.from,
      dateEnd: range.to,
    };
  }

  if (/mitnehmen|material.*mit|mitnahme|werkzeug.*braucht|was braucht/.test(t)) {
    const personName = extractPersonName(raw);
    const range = parseDateRangeFromText(t, reference);
    return {
      type: "employee_materials",
      personName,
      rawMessage: raw,
      date: range?.from,
      dateEnd: range?.to,
    };
  }

  if (/auftr[aä]ge hat|termine hat|termine von|termine f[uü]r/.test(t)) {
    const personName = extractPersonName(raw);
    const range = parseDateRangeFromText(t, reference);
    return {
      type: "employee_orders",
      personName,
      rawMessage: raw,
      date: range?.from,
      dateEnd: range?.to,
    };
  }

  if (/auftr[aä]ge mit|auftr[aä]ge.*t[uü]r|auftr[aä]ge.*fenster|aufma[sß]|material f[uü]r auftrag|suche nach/.test(t)) {
    const searchTerm = extractSearchTerm(raw) ?? raw.replace(/.*(?:mit|für|zum)\s+/i, "").trim();
    return { type: "order_search", searchTerm, rawMessage: raw };
  }

  if (/^(zeig mir|daten zu|informationen zu|wer ist)\s+/i.test(raw) || /^[\wäöüß-]+(\s+[\wäöüß-]+)?$/i.test(raw)) {
    const personName = extractPersonName(raw);
    if (personName) {
      return { type: "person_lookup", personName, rawMessage: raw };
    }
  }

  const searchTerm = extractSearchTerm(raw);
  if (searchTerm && searchTerm.length >= 3) {
    return { type: "order_search", searchTerm, rawMessage: raw };
  }

  return { type: "unknown", rawMessage: raw };
}

export function resolveDisambiguationIntent(
  message: string,
  choice: "employee" | "customer",
  personName: string
): AiIntent {
  return {
    type: "person_lookup",
    personName,
    disambiguationChoice: choice,
    rawMessage: message,
  };
}

export function intentLabel(type: AiIntentType): string {
  const labels: Record<AiIntentType, string> = {
    person_lookup: "Personensuche",
    list_employees: "Mitarbeiterliste",
    list_customers: "Kundenliste",
    employee_orders: "Termine/Aufträge Mitarbeiter",
    employee_materials: "Mitnahmeliste",
    order_search: "Auftragssuche",
    open_invoices: "Offene Rechnungen",
    missing_receipts: "Fehlende Belege",
    profit_analysis: "Gewinnanalyse",
    material_shortage: "Materialbedarf",
    machine_usage: "Maschineneinsatz",
    team_schedule: "Team-Termine",
    disambiguation: "Auswahl erforderlich",
    help: "Hilfe",
    unknown: "Allgemeine Anfrage",
  };
  return labels[type];
}
