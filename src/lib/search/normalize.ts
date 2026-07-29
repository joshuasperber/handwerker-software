/** Normalisierung für fehlertolerante Suche (Umlaute, Groß/Klein, Whitespace). */

const ASCII_TO_UMLAUT: Array<[RegExp, string]> = [
  [/ae/g, "ä"],
  [/oe/g, "ö"],
  [/ue/g, "ü"],
  [/ss/g, "ß"],
];

export function foldUmlauts(input: string): string {
  return input
    .replace(/[äÄ]/g, "ae")
    .replace(/[öÖ]/g, "oe")
    .replace(/[üÜ]/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function normalizeSearchText(input: string): string {
  return foldUmlauts(input).replace(/\s+/g, " ").trim();
}

/** Query-Varianten für Prisma `contains` (Original + ASCII-Umlaute + Umlaut-Form). */
export function queryVariants(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const lower = trimmed.toLowerCase();
  const folded = foldUmlauts(trimmed);
  const set = new Set<string>([trimmed, lower, folded]);

  // Wenn ASCII-Form: auch Umlaut-Variante versuchen (mueller → müller)
  let umlautGuess = folded;
  for (const [re, repl] of ASCII_TO_UMLAUT) {
    umlautGuess = umlautGuess.replace(re, repl);
  }
  if (umlautGuess !== folded) set.add(umlautGuess);

  return [...set].filter((v) => v.length > 0).slice(0, 6);
}

export function tokenize(raw: string): string[] {
  return normalizeSearchText(raw)
    .split(/[\s,.;:/\\|+]+/)
    .filter((t) => t.length > 0);
}
