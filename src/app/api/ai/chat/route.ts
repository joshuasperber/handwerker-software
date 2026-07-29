import { NextRequest } from "next/server";
import { requireAuth, apiSuccess, apiError, getClientIp } from "@/lib/api";
import { parseBody } from "@/lib/api-body";
import { chatMessageSchema } from "@/lib/ai/schemas";
import {
  processChatMessage,
  getOrCreateSession,
  saveChatMessages,
  logAiQuery,
  pruneOldSessions,
} from "@/lib/ai/chat-service";
import { assertSameOrigin } from "@/lib/security/origin";
import {
  isActionRateLimited,
  recordActionAttempt,
} from "@/lib/auth/action-rate-limit";

export async function POST(request: NextRequest) {
  const originError = assertSameOrigin(request);
  if (originError) return originError;

  const auth = await requireAuth("ai.chat");
  if (auth instanceof Response) return auth;

  const ip = getClientIp(request);
  const limited = await isActionRateLimited("ai_chat", `${auth.tenantId}:${auth.id}`);
  if (limited.limited) {
    return apiError(limited.reason ?? "Zu viele KI-Anfragen", 429);
  }
  await recordActionAttempt("ai_chat", `${auth.tenantId}:${auth.id}`, ip);

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
