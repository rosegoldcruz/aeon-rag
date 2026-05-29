import { generateText } from "ai"
import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import {
  appendChatMessage,
  createChatSession,
  getChatSession,
  makeSessionTitleFromMessage,
  updateSessionTitleIfNew,
} from "@/lib/chat-store"
import {
  createAiProvider,
  getAiProviderBaseURL,
  getAiProviderLabel,
  getAvailableAiModels,
  getDefaultAiModel,
  isProviderConfigured,
  resolveAiModel,
} from "@/lib/ai-provider"
import { normalizeAeonToolToggles, runAeonToolRouter } from "@/lib/aeon-tools"

type ChatMode = "chat" | "brainstorm" | "plan" | "image_prompt"
type ResponseStyle = "balanced" | "direct" | "detailed"

type ChatRequest = {
  message?: unknown
  messages?: unknown
  mode?: unknown
  model?: unknown
  sessionId?: unknown
  attachments?: unknown
  tools?: unknown
  crmContext?: unknown
  options?: {
    responseStyle?: unknown
    includeExecutionSteps?: unknown
    useUploadedContext?: unknown
  }
}

const DEFAULT_MODEL = getDefaultAiModel()
const SYSTEM_PROMPT =
  "You are AEON, an internal operations intelligence agent for SNRG Labs. You are a sharp systems partner, not a corporate chatbot. Default to short, direct answers in plain operational language. Prioritize what changed, what is broken, what matters, and the next move. Do not pad responses with generic bullet lists. Do not over-explain obvious concepts. Do not invent data. When using RAG, ground answers in retrieved context. If context is missing, state exactly what is missing and which query or tool would surface it. Match the user's urgency without becoming chaotic. Be useful, blunt, and execution-focused."

const MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  chat: "Respond naturally and helpfully based on the user request.",
  brainstorm:
    "Provide a structured brainstorm with sections: Ideas, Angles, and Next Actions. Keep it practical and specific.",
  plan: "Provide an actionable phased execution plan with clear steps, risks, and immediate next actions. No fluff.",
  image_prompt:
    "Return only a polished, production-ready image generation prompt based on user intent. Start with 'Image prompt:' and include style, composition, lighting, and mood.",
}

const FALLBACK_MODELS = getAvailableAiModels()
  .map((model) => model.id)
  .filter((model) => model !== DEFAULT_MODEL)

function isMode(value: unknown): value is ChatMode {
  return value === "chat" || value === "brainstorm" || value === "plan" || value === "image_prompt"
}

function isResponseStyle(value: unknown): value is ResponseStyle {
  return value === "balanced" || value === "direct" || value === "detailed"
}

function validateAiConfig(provider: ReturnType<typeof resolveAiModel>["provider"]) {
  return isProviderConfigured(provider)
    ? { ok: true as const }
    : {
        ok: false as const,
        message:
          provider === "mistral_codestral"
            ? "Missing required env var: MISTRAL_CODESTRAL_API_KEY, CODESTRAL_API_KEY, MISTRAL_VIBE_API_KEY, VIBE_API_KEY, or MISTRAL_API_KEY"
            : "Missing required env var: DEEPSEEK_API_KEY",
      }
}

function getInternalAuthStatus(request: Request) {
  const internalKey = request.headers.get("x-aeon-internal-key")?.trim()
  if (!internalKey) return { attempted: false as const, ok: false as const }

  const expectedKey = process.env.AEON_INTERNAL_API_KEY?.trim()
  if (!expectedKey) {
    return {
      attempted: true as const,
      ok: false as const,
      status: 503,
      message: "Missing required env var: AEON_INTERNAL_API_KEY",
    }
  }

  if (internalKey !== expectedKey) {
    return {
      attempted: true as const,
      ok: false as const,
      status: 401,
      message: "Unauthorized",
    }
  }

  return { attempted: true as const, ok: true as const }
}

function getTextFromMessagePart(part: unknown) {
  if (!part || typeof part !== "object") return ""
  const value = part as Record<string, unknown>
  if (typeof value.text === "string") return value.text
  if (typeof value.content === "string") return value.content
  return ""
}

function getMessageFromBody(body: ChatRequest) {
  if (typeof body.message === "string" && body.message.trim()) {
    return body.message.trim()
  }

  if (!Array.isArray(body.messages)) return ""

  const messages = body.messages as Array<Record<string, unknown>>
  const lastUserMessage = [...messages].reverse().find((item) => item?.role === "user") || messages.at(-1)
  if (!lastUserMessage || typeof lastUserMessage !== "object") return ""

  if (typeof lastUserMessage.content === "string") {
    return lastUserMessage.content.trim()
  }

  if (Array.isArray(lastUserMessage.parts)) {
    return lastUserMessage.parts.map(getTextFromMessagePart).join("\n").trim()
  }

  return ""
}

function buildCrmContextBlock(input: unknown) {
  if (!input || typeof input !== "object") return ""

  return [
    "CRM context supplied by a trusted internal workspace:",
    JSON.stringify(input, null, 2),
    "Use this CRM context as current request context only. Do not claim database writes or external actions unless a tool confirms them.",
  ].join("\n")
}

export async function POST(request: Request) {
  const internalAuth = getInternalAuthStatus(request)
  if (internalAuth.attempted && !internalAuth.ok) {
    return NextResponse.json({ ok: false, error: internalAuth.message }, { status: internalAuth.status })
  }

  const session = internalAuth.ok ? null : await getAuthenticatedSession()

  if (!internalAuth.ok && !session) {
    return unauthorizedResponse()
  }

  let body: ChatRequest

  try {
    body = (await request.json()) as ChatRequest
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    )
  }

  const message = getMessageFromBody(body)
  const mode: ChatMode = isMode(body.mode) ? body.mode : "chat"
  const requestedModel = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL
  const modelConfig = resolveAiModel(requestedModel)
  const model = modelConfig.id
  const sessionIdInput = typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : ""
  const attachments = Array.isArray(body.attachments) ? body.attachments : []
  const tools = normalizeAeonToolToggles(body.tools)
  const responseStyle = isResponseStyle(body.options?.responseStyle) ? body.options?.responseStyle : "balanced"
  const includeExecutionSteps = body.options?.includeExecutionSteps === true
  const useUploadedContext = body.options?.useUploadedContext !== false

  if (!message) {
    return NextResponse.json(
      {
        ok: false,
        error: "Message is required.",
      },
      { status: 400 },
    )
  }

  const configCheck = validateAiConfig(modelConfig.provider)
  if (!configCheck.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: configCheck.message,
      },
      { status: 503 },
    )
  }

  const styleInstruction =
    responseStyle === "direct"
      ? "Prefer concise, hard-edged execution guidance."
      : responseStyle === "detailed"
        ? "Provide expanded detail, rationale, and implementation specifics."
        : "Balance brevity with practical detail."

  const executionInstruction = includeExecutionSteps
    ? "Always include explicit execution steps and an immediate next action checklist."
    : "Execution steps are optional unless the user asks for them."

  const attachmentContext =
    attachments.length > 0
      ? `User attached files metadata: ${JSON.stringify(attachments)}`
      : ""
  const crmContextBlock = buildCrmContextBlock(body.crmContext)

  const toolResult = await runAeonToolRouter({
    message,
    tools: {
      ...tools,
      rag: tools.rag && useUploadedContext,
    },
    failOpen: true,
  })

  const candidateModels = Array.from(new Set([model, DEFAULT_MODEL, ...FALLBACK_MODELS].filter(Boolean)))
    .map((candidate) => resolveAiModel(candidate))
    .filter((candidate) => candidate.provider === modelConfig.provider && isProviderConfigured(candidate.provider))

  console.info("[api/chat] AI request start", {
    selectedModel: model,
    selectedProvider: modelConfig.provider,
    candidateModels: candidateModels.map((candidate) => candidate.id),
    candidateProviders: candidateModels.map((candidate) => candidate.provider),
    baseURL: getAiProviderBaseURL(modelConfig.provider),
    apiKeyConfigured: isProviderConfigured(modelConfig.provider),
    mode,
    attachmentCount: attachments.length,
    useUploadedContext,
    usedTools: toolResult.usedTools.map((tool) => tool.key),
    unavailableTools: toolResult.unavailableTools.map((tool) => tool.key),
    toolErrors: toolResult.toolErrors.map((tool) => tool.key),
  })

  const combinedSystem = [
    SYSTEM_PROMPT,
    MODE_INSTRUCTIONS[mode],
    styleInstruction,
    executionInstruction,
    attachmentContext,
    crmContextBlock,
    ...toolResult.contextBlocks,
  ]
    .filter(Boolean)
    .join("\n\n")

  let lastError = "Unknown AI provider request failure"

  let sessionId = sessionIdInput
  if (sessionId) {
    const existingSession = await getChatSession(sessionId)
    if (!existingSession) {
      sessionId = ""
    }
  }

  if (!sessionId) {
    const created = await createChatSession("New Chat")
    sessionId = created.id
  }

  await appendChatMessage({
    sessionId,
    role: "user",
    content: message,
    model,
  })

  await updateSessionTitleIfNew(sessionId, makeSessionTitleFromMessage(message))

  for (const candidate of candidateModels) {
    try {
      const provider = createAiProvider(candidate.provider)
      const result = await generateText({
        model: provider(candidate.id),
        system: combinedSystem,
        prompt: message,
      })

      console.info("[api/chat] AI response received", {
        provider: candidate.provider,
        usedModel: candidate.id,
        textLength: result.text.length,
      })

      await appendChatMessage({
        sessionId,
        role: "assistant",
        content: result.text,
        model: candidate.id,
        ...(toolResult.sources.length > 0 ? { sources: toolResult.sources } : {}),
      })

      return NextResponse.json({
        ok: true,
        message: result.text,
        mode,
        model: candidate.id,
        provider: getAiProviderLabel(candidate.provider),
        sessionId,
        toolTrace: {
          usedTools: toolResult.usedTools,
          unavailableTools: toolResult.unavailableTools,
          toolErrors: toolResult.toolErrors,
        },
        ...(toolResult.sources.length > 0 ? { sources: toolResult.sources } : {}),
      })
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "Unknown AI provider request failure"
      lastError = safeMessage
      console.error("[api/chat] AI model attempt failed", {
        attemptedProvider: candidate.provider,
        attemptedModel: candidate.id,
        message: safeMessage,
      })
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: `AI provider model call failed: ${lastError}`,
    },
    { status: 502 },
  )
}