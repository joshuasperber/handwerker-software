import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { chatMessageSchema } from "@/lib/ai/schemas";
import {
  processChatMessage,
  getOrCreateSession,
  saveChatMessages,
  logAiQuery,
  pruneOldSessions,
} from "@/lib/ai/chat-service";

export async function POST(request: NextRequest) {
  const auth = await requireAuth("ai.chat");
  if (auth instanceof Response) return auth;

  const body = await parseBody(request, chatMessageSchema);
  if (body instanceof Response) return body;

  const session = await getOrCreateSession(auth, body.sessionId);

  const result = await processChatMessage(auth, body.message, {
    disambiguationChoice: body.disambiguationChoice,
    disambiguationName: body.disambiguationName,
  });

  await saveChatMessages(session.id, body.message, result);
  await logAiQuery(auth, session.id, body.message, result);
  await pruneOldSessions(auth, 3);

  return apiSuccess({
    sessionId: session.id,
    content: result.content,
    intent: result.intent,
    dataSources: result.dataSources,
    confidence: result.confidence,
    missingData: result.missingData,
    disambiguationOptions: result.disambiguationOptions,
  });
}
