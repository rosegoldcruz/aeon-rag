import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { deleteChatSession, getChatMessages, getChatSession } from "@/lib/chat-store"

export const runtime = "nodejs"

type RouteContext = {
  params: Promise<{ id: string }>
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

export async function GET(_request: Request, context: RouteContext) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const { id } = await context.params
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 })
  }

  try {
    const chat = await getChatSession(id)
    if (!chat) {
      return NextResponse.json({ ok: false, error: "Chat not found." }, { status: 404 })
    }

    const messages = await getChatMessages(id)

    return NextResponse.json({
      ok: true,
      session: {
        id: chat.id,
        title: chat.title,
        createdAt: chat.created_at,
        updatedAt: chat.updated_at,
      },
      messages: messages.map((item) => ({
        id: item.id,
        sessionId: item.session_id,
        role: item.role,
        content: item.content,
        model: item.model,
        sources: item.sources,
        createdAt: item.created_at,
      })),
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown chat read failure"
    console.error("[api/chats/:id] read failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load chat.",
      },
      { status: 500 },
    )
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const { id } = await context.params
  if (!isUuid(id)) {
    return NextResponse.json({ ok: false, error: "Invalid session id." }, { status: 400 })
  }

  try {
    const deleted = await deleteChatSession(id)
    if (!deleted) {
      return NextResponse.json({ ok: false, error: "Chat not found." }, { status: 404 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown chat delete failure"
    console.error("[api/chats/:id] delete failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to delete chat.",
      },
      { status: 500 },
    )
  }
}
