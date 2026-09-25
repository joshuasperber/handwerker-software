import "dotenv/config";
import { readFileSync } from "node:fs";

function refFromSupabaseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const host = new URL(value).hostname;
    return host.endsWith(".supabase.co")
      ? host.slice(0, -".supabase.co".length)
      : null;
  } catch {
    return null;
  }
}

function refFromDatabaseUrl(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const direct = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1];
    const pooled = decodeURIComponent(url.username).match(/^postgres\.([a-z0-9]+)$/)?.[1];
    return direct ?? pooled ?? null;
  } catch {
    return null;
  }
}

function linkedRef() {
  try {
    return readFileSync("supabase/.temp/project-ref", "utf8").trim() || null;
  } catch {
    return null;
  }
}

const appRef = refFromSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
const databaseRef = refFromDatabaseUrl(process.env.DIRECT_URL || process.env.DATABASE_URL);
const cliRef = linkedRef();

console.log(`App-Konfiguration: ${appRef ?? "nicht ermittelbar"}`);
console.log(`Datenbank:        ${databaseRef ?? "nicht ermittelbar"}`);
console.log(`Supabase CLI:     ${cliRef ?? "nicht verknüpft"}`);

if (appRef && databaseRef && appRef !== databaseRef) {
  console.error("WARNUNG: App und Datenbank zeigen auf unterschiedliche Supabase-Projekte.");
  process.exitCode = 1;
}
if (cliRef && databaseRef && cliRef !== databaseRef) {
  console.error("WARNUNG: CLI und DATABASE_URL zeigen auf unterschiedliche Supabase-Projekte.");
  process.exitCode = 1;
}
