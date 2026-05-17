import { readFile } from "node:fs/promises"
import pool from "@/lib/db"

type ChatRole = "user" | "assistant" | "system"

export type ChatSessionRow = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type ChatMessageRow = {
  id: string
  session_id: string
  role: ChatRole
  content: string
  model: string | null
  sources: unknown
  created_at: string
}

const CHAT_MIGRATION_FILE = "/home/aeon-rag/migrations/002_chat_sessions.sql"

let schemaPromise: Promise<void> | null = null

export async function ensureChatSchema() {
  if (schemaPromise) {
    return schemaPromise
  }

  schemaPromise = (async () => {
    const sql = await readFile(CHAT_MIGRATION_FILE, "utf8")
    await pool.query(sql)
  })()

  return schemaPromise
}

export function makeSessionTitleFromMessage(input: string) {
  const condensed = input.replace(/\s+/g, " ").trim()
  if (!condensed) {
    return "New Chat"
  }

  if (condensed.length <= 72) {
    return condensed
  }

  return `${condensed.slice(0, 69).trimEnd()}...`
}

export async function listChatSessions(limit = 50) {
  await ensureChatSchema()

  const result = await pool.query<ChatSessionRow & { last_message: string | null }>(
    `
    SELECT
      s.id,
      s.title,
      s.created_at,
      s.updated_at,
      (
        SELECT m.content
        FROM chat_messages m
        WHERE m.session_id = s.id
        ORDER BY m.created_at DESC
        LIMIT 1
      ) AS last_message
    FROM chat_sessions s
    ORDER BY s.updated_at DESC
    LIMIT $1
    `,
    [Math.max(1, Math.min(limit, 200))],
  )

  return result.rows
}

export async function createChatSession(title = "New Chat") {
  await ensureChatSchema()

  const result = await pool.query<ChatSessionRow>(
    `
    INSERT INTO chat_sessions (title)
    VALUES ($1)
    RETURNING id, title, created_at, updated_at
    `,
    [title.trim() || "New Chat"],
  )

  return result.rows[0]
}

export async function getChatSession(sessionId: string) {
  await ensureChatSchema()

  const result = await pool.query<ChatSessionRow>(
    `
    SELECT id, title, created_at, updated_at
    FROM chat_sessions
    WHERE id = $1
    LIMIT 1
    `,
    [sessionId],
  )

  return result.rows[0] ?? null
}

export async function getChatMessages(sessionId: string) {
  await ensureChatSchema()

  const result = await pool.query<ChatMessageRow>(
    `
    SELECT id, session_id, role, content, model, sources, created_at
    FROM chat_messages
    WHERE session_id = $1
    ORDER BY created_at ASC
    `,
    [sessionId],
  )

  return result.rows
}

export async function deleteChatSession(sessionId: string) {
  await ensureChatSchema()

  const result = await pool.query<{ id: string }>(
    `
    DELETE FROM chat_sessions
    WHERE id = $1
    RETURNING id
    `,
    [sessionId],
  )

  return (result.rowCount ?? 0) > 0
}

export async function touchChatSession(sessionId: string) {
  await ensureChatSchema()

  await pool.query(
    `
    UPDATE chat_sessions
    SET updated_at = now()
    WHERE id = $1
    `,
    [sessionId],
  )
}

export async function updateSessionTitleIfNew(sessionId: string, title: string) {
  await ensureChatSchema()

  await pool.query(
    `
    UPDATE chat_sessions
    SET title = $2, updated_at = now()
    WHERE id = $1 AND title = 'New Chat'
    `,
    [sessionId, title],
  )
}

export async function appendChatMessage(input: {
  sessionId: string
  role: ChatRole
  content: string
  model?: string
  sources?: unknown
}) {
  await ensureChatSchema()

  const result = await pool.query<ChatMessageRow>(
    `
    INSERT INTO chat_messages (session_id, role, content, model, sources)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, session_id, role, content, model, sources, created_at
    `,
    [input.sessionId, input.role, input.content, input.model ?? null, input.sources ? JSON.stringify(input.sources) : null],
  )

  await touchChatSession(input.sessionId)
  return result.rows[0]
}