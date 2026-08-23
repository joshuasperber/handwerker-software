import { GET as runDaily, POST as postDaily, maxDuration } from "../daily/route";

export { maxDuration };

/** Stündlich nur Erinnerungen — SMS bleibt vorbereitet, Versand folgt bei Provider-Anschluss. */
function remindersOnly(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("jobs", "reminders");
  return new Request(url, request);
}

export async function GET(request: Request) {
  return runDaily(remindersOnly(request));
}

export async function POST(request: Request) {
  return postDaily(remindersOnly(request));
}
