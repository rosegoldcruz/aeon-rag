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
  createDeepSeekProvider,
  DEEPSEEK_BASE_URL,
  DEEPSEEK_MODELS,
  getDefaultDeepSeekModel,
  getDeepSeekApiKey,
  isDeepSeekModel,
} from "@/lib/deepseek"
import { retrieveContext } from "@/lib/retrieve"

type ChatMode = "chat" | "brainstorm" | "plan" | "image_prompt"
type ResponseStyle = "balanced" | "direct" | "detailed"

type ChatRequest = {
  message?: unknown
  mode?: unknown
  model?: unknown
  sessionId?: unknown
  attachments?: unknown
  options?: {
    responseStyle?: unknown
    includeExecutionSteps?: unknown
    useUploadedContext?: unknown
  }
}

const SUPPORTED_MODELS = DEEPSEEK_MODELS.map((model) => model.id)
const DEFAULT_MODEL = getDefaultDeepSeekModel()
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

const FALLBACK_MODELS = SUPPORTED_MODELS.filter((model) => model !== DEFAULT_MODEL)

function isMode(value: unknown): value is ChatMode {
  return value === "chat" || value === "brainstorm" || value === "plan" || value === "image_prompt"
}

function isResponseStyle(value: unknown): value is ResponseStyle {
  return value === "balanced" || value === "direct" || value === "detailed"
}

function validateDeepSeekConfig() {
  try {
    getDeepSeekApiKey()
    return { ok: true as const }
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : "DeepSeek is not configured.",
    }
  }
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession()

  if (!session) {
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

  const message = typeof body.message === "string" ? body.message.trim() : ""
  const mode: ChatMode = isMode(body.mode) ? body.mode : "chat"
  const requestedModel = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL
  const model = isDeepSeekModel(requestedModel) ? requestedModel : DEFAULT_MODEL
  const sessionIdInput = typeof body.sessionId === "string" && body.sessionId.trim() ? body.sessionId.trim() : ""
  const attachments = Array.isArray(body.attachments) ? body.attachments : []
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

  const configCheck = validateDeepSeekConfig()
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

  let retrievedContextBlock = ""
  let retrievedChunkCount = 0
  let retrievedSources: Array<{ documentName: string; content: string; score?: number }> = []

  if (useUploadedContext) {
    try {
      const retrieved = await retrieveContext(message, 5)
      retrievedSources = retrieved.sources

      if (retrieved.context) {
        retrievedChunkCount = retrieved.sources.length
        retrievedContextBlock =
          "Relevant context from uploaded documents:\n" +
          retrieved.context +
          "\n\nUse this context where relevant. If the context does not answer the question, say so and answer from general reasoning. Include sources when practical."
      }
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "Unknown retrieval failure"
      console.error("[api/chat] Retrieval step failed", { message: safeMessage })
    }
  }

  const candidateModels = Array.from(new Set([model, DEFAULT_MODEL, ...FALLBACK_MODELS].filter(Boolean)))

  console.info("[api/chat] DeepSeek request start", {
    selectedModel: model,
    candidateModels,
    baseURL: DEEPSEEK_BASE_URL,
    apiKeyConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
    mode,
    attachmentCount: attachments.length,
    useUploadedContext,
    retrievedChunkCount,
  })

  const combinedSystem = [
    SYSTEM_PROMPT,
    MODE_INSTRUCTIONS[mode],
    styleInstruction,
    executionInstruction,
    attachmentContext,
    retrievedContextBlock,
  ]
    .filter(Boolean)
    .join("\n\n")

  let lastError = "Unknown DeepSeek request failure"
  const deepseek = createDeepSeekProvider()

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
      const result = await generateText({
        model: deepseek(candidate),
        system: combinedSystem,
        prompt: message,
      })

      console.info("[api/chat] DeepSeek response received", {
        usedModel: candidate,
        textLength: result.text.length,
      })

      await appendChatMessage({
        sessionId,
        role: "assistant",
        content: result.text,
        model: candidate,
        ...(retrievedSources.length > 0 ? { sources: retrievedSources } : {}),
      })

      return NextResponse.json({
        ok: true,
        message: result.text,
        mode,
        model: candidate,
        sessionId,
        ...(retrievedSources.length > 0 ? { sources: retrievedSources } : {}),
      })
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "Unknown DeepSeek request failure"
      lastError = safeMessage
      console.error("[api/chat] DeepSeek model attempt failed", {
        attemptedModel: candidate,
        message: safeMessage,
      })
    }
  }

  return NextResponse.json(
    {
      ok: false,
      error: `DeepSeek model call failed: ${lastError}`,
    },
    { status: 502 },
  )
}