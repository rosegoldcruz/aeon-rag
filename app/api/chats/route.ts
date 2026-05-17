import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { createChatSession, listChatSessions } from "@/lib/chat-store"

export const runtime = "nodejs"

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  try {
    const sessions = await listChatSessions(100)

    return NextResponse.json({
      ok: true,
      sessions: sessions.map((item) => ({
        id: item.id,
        title: item.title,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
        lastMessagePreview: item.last_message,
      })),
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown chats list failure"
    console.error("[api/chats] list failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load chats.",
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

  let title = "New Chat"

  try {
    const body = (await request.json()) as { title?: unknown }
    if (typeof body.title === "string" && body.title.trim()) {
      title = body.title.trim()
    }
  } catch {
    // Allow empty request body and use default title.
  }

  try {
    const created = await createChatSession(title)

    return NextResponse.json({
      ok: true,
      session: {
        id: created.id,
        title: created.title,
        createdAt: created.created_at,
        updatedAt: created.updated_at,
      },
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown session creation failure"
    console.error("[api/chats] create failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to create chat.",
      },
      { status: 500 },
    )
  }
}
