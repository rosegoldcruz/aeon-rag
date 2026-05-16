import { generateText } from "ai"
import { vertex } from "@ai-sdk/google-vertex"
import { access } from "node:fs/promises"
import { NextResponse } from "next/server"

type ChatMode = "chat" | "brainstorm" | "plan" | "image_prompt"
type ResponseStyle = "balanced" | "direct" | "detailed"

type ChatRequest = {
  message?: unknown
  mode?: unknown
  model?: unknown
  attachments?: unknown
  options?: {
    responseStyle?: unknown
    includeExecutionSteps?: unknown
  }
}

const DEFAULT_MODEL = process.env.VERTEX_MODEL || "gemini-1.5-pro"
const SYSTEM_PROMPT =
  "You are AEON Ops, a private operating intelligence layer for Daniel Cruz. Be direct, execution-focused, and practical. Help turn ideas into plans, system prompts, architecture, and implementation steps."

const MODE_INSTRUCTIONS: Record<ChatMode, string> = {
  chat: "Respond naturally and helpfully based on the user request.",
  brainstorm:
    "Provide a structured brainstorm with sections: Ideas, Angles, and Next Actions. Keep it practical and specific.",
  plan: "Provide an actionable phased execution plan with clear steps, risks, and immediate next actions. No fluff.",
  image_prompt:
    "Return only a polished, production-ready image generation prompt based on user intent. Start with 'Image prompt:' and include style, composition, lighting, and mood.",
}

function isMode(value: unknown): value is ChatMode {
  return value === "chat" || value === "brainstorm" || value === "plan" || value === "image_prompt"
}

function isResponseStyle(value: unknown): value is ResponseStyle {
  return value === "balanced" || value === "direct" || value === "detailed"
}

async function validateVertexConfig() {
  const project = process.env.GOOGLE_VERTEX_PROJECT
  const location = process.env.GOOGLE_VERTEX_LOCATION
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS

  if (!project || !location) {
    return {
      ok: false as const,
      message:
        "Vertex is not configured. Missing GOOGLE_VERTEX_PROJECT or GOOGLE_VERTEX_LOCATION environment variables.",
    }
  }

  if (!credentialsPath) {
    return {
      ok: false as const,
      message:
        "Vertex credentials are missing. Set GOOGLE_APPLICATION_CREDENTIALS to a valid service account JSON path.",
    }
  }

  try {
    await access(credentialsPath)
  } catch {
    return {
      ok: false as const,
      message:
        "Vertex credentials file was not found at GOOGLE_APPLICATION_CREDENTIALS. Update the path or provide valid credentials.",
    }
  }

  return { ok: true as const }
}

export async function POST(request: Request) {
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
  const model = typeof body.model === "string" && body.model.trim() ? body.model.trim() : DEFAULT_MODEL
  const attachments = Array.isArray(body.attachments) ? body.attachments : []
  const responseStyle = isResponseStyle(body.options?.responseStyle) ? body.options?.responseStyle : "balanced"
  const includeExecutionSteps = body.options?.includeExecutionSteps === true

  if (!message) {
    return NextResponse.json(
      {
        ok: false,
        error: "Message is required.",
      },
      { status: 400 },
    )
  }

  const configCheck = await validateVertexConfig()
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
      ? `User attached files metadata (retrieval not implemented yet): ${JSON.stringify(attachments)}`
      : ""

  try {
    const result = await generateText({
      model: vertex(model),
      system: [SYSTEM_PROMPT, MODE_INSTRUCTIONS[mode], styleInstruction, executionInstruction, attachmentContext]
        .filter(Boolean)
        .join("\n\n"),
      prompt: message,
    })

    return NextResponse.json({
      ok: true,
      message: result.text,
      mode,
      model,
      chatId: undefined,
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown Vertex request failure"
    console.error("[api/chat] Vertex request failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: `Vertex model call failed: ${safeMessage}`,
      },
      { status: 502 },
    )
  }
}