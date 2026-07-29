import { normalizeSearchText, tokenize } from "./normalize";

/** Einfache Levenshtein-Distanz (für kurze Strings). */
export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j]!;
  }
  return prev[b.length]!;
}

/**
 * Score 0–100: höher = besserer Treffer.
 * Berücksichtigt Prefix, Contains, Token-Treffer und Tippfehler.
 */
export function scoreMatch(query: string, ...haystacks: Array<string | null | undefined>): number {
  const q = normalizeSearchText(query);
  if (!q) return 0;
  const fields = haystacks
    .map((h) => normalizeSearchText(h ?? ""))
    .filter(Boolean);
  if (fields.length === 0) return 0;

  let best = 0;
  const tokens = tokenize(query);

  for (const field of fields) {
    if (field === q) {
      best = Math.max(best, 100);
      continue;
    }
    if (field.startsWith(q)) {
      best = Math.max(best, 92);
      continue;
    }
    if (field.includes(q)) {
      best = Math.max(best, 80);
      continue;
    }

    // Token: jedes Query-Token muss irgendwo im Feld vorkommen (fuzzy)
    if (tokens.length > 1) {
      let tokenScore = 0;
      let matched = 0;
      for (const t of tokens) {
        if (field.includes(t) || field.startsWith(t)) {
          matched++;
          tokenScore += 20;
        } else {
          const words = field.split(" ");
          let ok = false;
          for (const w of words) {
            if (fuzzyWordMatch(t, w)) {
              ok = true;
              break;
            }
          }
          if (ok) {
            matched++;
            tokenScore += 12;
          }
        }
      }
      if (matched === tokens.length) {
        best = Math.max(best, Math.min(78, 40 + tokenScore));
      } else if (matched > 0) {
        best = Math.max(best, Math.min(55, 20 + tokenScore));
      }
    }

    // Einzelwort / Prefix-Fuzzy auf Feldteilen
    for (const word of field.split(" ")) {
      if (!word) continue;
      if (word.startsWith(q) || q.startsWith(word)) {
        best = Math.max(best, 70);
        continue;
      }
      if (fuzzyWordMatch(q, word)) {
        best = Math.max(best, 58);
      }
    }
  }

  return best;
}

function fuzzyWordMatch(query: string, word: string): boolean {
  if (!query || !word) return false;
  if (word.includes(query) || query.includes(word)) return true;
  // Kurze Queries: nur Prefix/Contains, sonst zu viele False Positives
  if (query.length < 3) return false;
  const maxDist = query.length <= 4 ? 1 : query.length <= 7 ? 2 : 3;
  if (Math.abs(word.length - query.length) > maxDist) {
    // Erlaubt: Query ist Prefix mit Tippfehler-Länge
    if (word.length > query.length && word.slice(0, query.length + 1)) {
      return levenshtein(query, word.slice(0, query.length)) <= 1;
    }
    return false;
  }
  return levenshtein(query, word) <= maxDist;
}

/** Mindestscore, damit ein Treffer angezeigt wird. */
export const MIN_MATCH_SCORE = 45;
