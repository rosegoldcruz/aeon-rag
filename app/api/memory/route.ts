import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { createMemory, listMemories } from "@/lib/memory/store"

type CreateMemoryRequest = {
  type?: unknown
  scope?: unknown
  title?: unknown
  content?: unknown
  importance?: unknown
  confidence?: unknown
  source?: unknown
  reason?: unknown
}

export const runtime = "nodejs"

export async function GET(request: Request) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const { searchParams } = new URL(request.url)
  const rawLimit = Number(searchParams.get("limit"))
  const limit = Number.isFinite(rawLimit) ? rawLimit : 50

  try {
    const memories = await listMemories(limit)
    return NextResponse.json({ ok: true, memories })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown memory read failure"
    console.error("[api/memory] read failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to read memory.",
      },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  let body: CreateMemoryRequest

  try {
    body = (await request.json()) as CreateMemoryRequest
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    )
  }

  const type = typeof body.type === "string" ? body.type.trim() : ""
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""

  if (!type) {
    return NextResponse.json(
      {
        ok: false,
        error: "type is required.",
      },
      { status: 400 },
    )
  }

  if (!title) {
    return NextResponse.json(
      {
        ok: false,
        error: "title is required.",
      },
      { status: 400 },
    )
  }

  if (!content) {
    return NextResponse.json(
      {
        ok: false,
        error: "content is required.",
      },
      { status: 400 },
    )
  }

  try {
    const memory = await createMemory({
      type,
      scope: typeof body.scope === "string" ? body.scope : undefined,
      title,
      content,
      importance: typeof body.importance === "number" ? body.importance : undefined,
      confidence: typeof body.confidence === "number" ? body.confidence : undefined,
      source: typeof body.source === "string" ? body.source : undefined,
      reason: typeof body.reason === "string" ? body.reason : undefined,
    })

    return NextResponse.json({ ok: true, memory })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown memory write failure"
    console.error("[api/memory] create failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to write memory.",
      },
      { status: 500 },
    )
  }
}
