import type { Prisma } from "@/generated/prisma/client";
import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { parseIntent, resolveDisambiguationIntent } from "./intent-parser";
import type { AiChatResult, AiIntent } from "./types";
import {
  findPersonMatches,
  fetchPersonDetails,
  fetchEmployeeList,
  fetchCustomerList,
  fetchEmployeeOrders,
  fetchEmployeeMaterials,
  searchOrders,
  fetchOpenInvoices,
  fetchMissingReceipts,
  fetchProfitAnalysis,
  fetchMaterialShortage,
  fetchMachineUsage,
  fetchTeamSchedule,
} from "./data-fetchers";
import {
  formatHelpResponse,
  formatDisambiguation,
  formatPersonLookup,
  formatEmployeeList,
  formatCustomerList,
  formatEmployeeOrders,
  formatEmployeeMaterials,
  formatOrderSearch,
  formatOpenInvoices,
  formatMissingReceipts,
  formatProfitAnalysis,
  formatMaterialShortage,
  formatMachineUsage,
  formatTeamSchedule,
  formatUnknown,
  formatError,
} from "./format-response";
import { enhanceWithLlm, classifyIntentWithLlm } from "./llm-client";

function toJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasFetchError(result: unknown): result is { error: string } {
  return (
    typeof result === "object" &&
    result !== null &&
    "error" in result &&
    typeof (result as { error: unknown }).error === "string"
  );
}

async function executeIntent(auth: SessionUser, intent: AiIntent): Promise<AiChatResult> {
  switch (intent.type) {
    case "help":
      return formatHelpResponse();

    case "list_employees": {
      const result = await fetchEmployeeList(auth);
      if (hasFetchError(result)) return formatError(result.error, "list_employees");
      return formatEmployeeList(result as Parameters<typeof formatEmployeeList>[0]);
    }

    case "list_customers": {
      const result = await fetchCustomerList(auth);
      if (hasFetchError(result)) return formatError(result.error, "list_customers");
      return formatCustomerList(result as Parameters<typeof formatCustomerList>[0]);
    }

    case "person_lookup": {
      if (!intent.personName) {
        return formatError('Bitte gib einen Namen an, z. B. „Zeig mir Anton".');
      }
      let matches = await findPersonMatches(auth, intent.personName);

      if (intent.disambiguationChoice) {
        matches = matches.filter((m) => m.type === intent.disambiguationChoice);
      }

      if (matches.length === 0) {
        return formatError(`Ich habe niemanden mit dem Namen „${intent.personName}" gefunden.`);
      }
      if (matches.length > 1 && !intent.disambiguationChoice) {
        const employees = matches.filter((m) => m.type === "employee");
        const customers = matches.filter((m) => m.type === "customer");
        if (employees.length && customers.length) {
          return formatDisambiguation(matches, intent.personName);
        }
      }

      const data = await fetchPersonDetails(auth, matches[0]);
      return formatPersonLookup(data);
    }

    case "employee_orders": {
      const result = await fetchEmployeeOrders(auth, intent);
      if (hasFetchError(result)) return formatError(result.error, "employee_orders");
      return formatEmployeeOrders(result as Parameters<typeof formatEmployeeOrders>[0]);
    }

    case "employee_materials": {
      const result = await fetchEmployeeMaterials(auth, intent);
      if (hasFetchError(result)) return formatError(result.error, "employee_materials");
      return formatEmployeeMaterials(result as Parameters<typeof formatEmployeeMaterials>[0]);
    }

    case "order_search": {
      if (!intent.searchTerm) {
        return formatError('Bitte gib einen Suchbegriff an, z. B. „Tür anbringen".');
      }
      const result = await searchOrders(auth, intent.searchTerm);
      if (hasFetchError(result)) return formatError(result.error, "order_search");
      return formatOrderSearch(result as Parameters<typeof formatOrderSearch>[0]);
    }

    case "open_invoices": {
      const result = await fetchOpenInvoices(auth);
      if (hasFetchError(result)) return formatError(result.error, "open_invoices");
      return formatOpenInvoices(result as Parameters<typeof formatOpenInvoices>[0]);
    }

    case "missing_receipts": {
      const result = await fetchMissingReceipts(auth);
      if (hasFetchError(result)) return formatError(result.error, "missing_receipts");
      return formatMissingReceipts(result as Parameters<typeof formatMissingReceipts>[0]);
    }

    case "profit_analysis": {
      const result = await fetchProfitAnalysis(auth);
      if (hasFetchError(result)) return formatError(result.error, "profit_analysis");
      return formatProfitAnalysis(result as Parameters<typeof formatProfitAnalysis>[0]);
    }

    case "material_shortage": {
      const result = await fetchMaterialShortage(auth, intent);
      if (hasFetchError(result)) return formatError(result.error, "material_shortage");
      return formatMaterialShortage(result as Parameters<typeof formatMaterialShortage>[0]);
    }

    case "machine_usage": {
      const result = await fetchMachineUsage(auth);
      if (hasFetchError(result)) return formatError(result.error, "machine_usage");
      return formatMachineUsage(result as Parameters<typeof formatMachineUsage>[0]);
    }

    case "team_schedule": {
      const result = await fetchTeamSchedule(auth, intent);
      if (hasFetchError(result)) return formatError(result.error, "team_schedule");
      return formatTeamSchedule(result as Parameters<typeof formatTeamSchedule>[0]);
    }

    default:
      return formatUnknown(intent);
  }
}

export async function processChatMessage(
  auth: SessionUser,
  message: string,
  options?: {
    disambiguationChoice?: "employee" | "customer";
    disambiguationName?: string;
  }
): Promise<AiChatResult> {
  let intent = parseIntent(message);

  if (options?.disambiguationChoice && options.disambiguationName) {
    intent = resolveDisambiguationIntent(
      message,
      options.disambiguationChoice,
      options.disambiguationName
    );
  } else if (intent.type === "unknown") {
    // Umgangssprache / unklare Formulierungen → KI ordnet Intent zu, Daten kommen weiter aus der DB
    const llmIntent = await classifyIntentWithLlm(message);
    if (llmIntent && llmIntent.type !== "unknown") {
      intent = llmIntent;
    }
  }

  const structured = await executeIntent(auth, intent);

  // Falls Personensuche leer war, könnte die Formulierung eigentlich eine Liste gemeint haben
  if (
    structured.intent === "person_lookup" &&
    structured.dataSources.length === 0 &&
    /mitarbeiter|kunden|alle|liste|nennen/i.test(message)
  ) {
    const llmIntent = await classifyIntentWithLlm(message);
    if (llmIntent && llmIntent.type !== "unknown" && llmIntent.type !== "person_lookup") {
      const retry = await executeIntent(auth, llmIntent);
      const enhancedRetry = await enhanceWithLlm(message, retry);
      if (enhancedRetry) return { ...retry, content: enhancedRetry };
      return retry;
    }
  }

  const enhanced = await enhanceWithLlm(message, structured);
  if (enhanced) {
    return { ...structured, content: enhanced };
  }

  return structured;
}

export async function logAiQuery(
  auth: SessionUser,
  sessionId: string,
  query: string,
  result: AiChatResult
) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId: auth.tenantId,
        userId: auth.id,
        entityType: "ai_chat",
        entityId: sessionId,
        action: "query",
        newValues: toJson({
          query,
          intent: result.intent,
          dataSources: result.dataSources,
          confidence: result.confidence,
        }),
      },
    });
  } catch (err) {
    console.error("[ai] audit log failed:", err);
  }
}

export async function getOrCreateSession(auth: SessionUser, sessionId?: string) {
  if (sessionId) {
    const existing = await prisma.aiChatSession.findFirst({
      where: { id: sessionId, userId: auth.id, tenantId: auth.tenantId },
    });
    if (existing) return existing;
  }

  return prisma.aiChatSession.create({
    data: {
      tenantId: auth.tenantId,
      userId: auth.id,
      title: "Neuer Chat",
    },
  });
}

export async function saveChatMessages(
  sessionId: string,
  userMessage: string,
  result: AiChatResult
) {
  await prisma.$transaction([
    prisma.aiChatMessage.create({
      data: {
        sessionId,
        role: "user",
        content: userMessage,
      },
    }),
    prisma.aiChatMessage.create({
      data: {
        sessionId,
        role: "assistant",
        content: result.content,
        metadata: toJson({
          intent: result.intent,
          dataSources: result.dataSources,
          confidence: result.confidence,
          missingData: result.missingData,
          disambiguationOptions: result.disambiguationOptions,
        }),
      },
    }),
    prisma.aiChatSession.update({
      where: { id: sessionId },
      data: {
        updatedAt: new Date(),
        title: userMessage.slice(0, 80),
      },
    }),
  ]);
}

/** Behält nur die neuesten N Chats pro Nutzer (ältere werden gelöscht). */
export async function pruneOldSessions(auth: SessionUser, keep = 3) {
  const sessions = await prisma.aiChatSession.findMany({
    where: { tenantId: auth.tenantId, userId: auth.id },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const toDelete = sessions.slice(keep).map((s) => s.id);
  if (toDelete.length === 0) return;

  await prisma.aiChatSession.deleteMany({
    where: { id: { in: toDelete }, userId: auth.id, tenantId: auth.tenantId },
  });
}
