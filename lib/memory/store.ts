import pool from "@/lib/db"
import { completeToolCallAudit, createToolCallAudit } from "@/lib/tools/audit"

export type MemoryRecord = {
  id: string
  type: string
  scope: string
  title: string
  content: string
  importance: number
  confidence: number
  source: string | null
  created_at: string
  updated_at: string
  last_used_at: string | null
}

export async function listMemories(limit = 50) {
  const safeLimit = Math.max(1, Math.min(limit, 200))

  const auditId = await createToolCallAudit({
    toolName: "memory.list",
    toolType: "memory",
    payload: { limit: safeLimit },
  })

  try {
    const result = await pool.query<MemoryRecord>(
      `
      SELECT id, type, scope, title, content, importance, confidence, source, created_at, updated_at, last_used_at
      FROM aeon_memories
      ORDER BY updated_at DESC
      LIMIT $1
      `,
      [safeLimit],
    )

    if (auditId) {
      await completeToolCallAudit({
        id: auditId,
        status: "success",
        outputSummary: `count=${result.rowCount ?? 0}`,
      })
    }

    return result.rows
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown memory list failure"
    if (auditId) {
      await completeToolCallAudit({ id: auditId, status: "error", error: safeMessage })
    }

    throw error
  }
}

export async function createMemory(input: {
  type: string
  scope?: string
  title: string
  content: string
  importance?: number
  confidence?: number
  source?: string
  reason?: string
}) {
  const type = input.type.trim()
  const title = input.title.trim()
  const content = input.content.trim()
  const scope = input.scope?.trim() || "global"
  const importance = Number.isFinite(input.importance) ? Math.max(1, Math.min(5, Number(input.importance))) : 3
  const confidence = Number.isFinite(input.confidence) ? Math.max(0, Math.min(1, Number(input.confidence))) : 0.8

  const auditId = await createToolCallAudit({
    toolName: "memory.create",
    toolType: "memory",
    payload: { type, scope, title },
  })

  try {
    const inserted = await pool.query<MemoryRecord>(
      `
      INSERT INTO aeon_memories (type, scope, title, content, importance, confidence, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, type, scope, title, content, importance, confidence, source, created_at, updated_at, last_used_at
      `,
      [type, scope, title, content, importance, confidence, input.source?.trim() || null],
    )

    const memory = inserted.rows[0]

    await pool.query(
      `
      INSERT INTO aeon_memory_events (memory_id, event_type, old_value, new_value, reason)
      VALUES ($1, 'created', NULL, $2, $3)
      `,
      [
        memory.id,
        JSON.stringify({ type: memory.type, scope: memory.scope, title: memory.title, importance: memory.importance, confidence: memory.confidence }),
        input.reason?.trim() || null,
      ],
    )

    if (auditId) {
      await completeToolCallAudit({
        id: auditId,
        status: "success",
        outputSummary: `memory_id=${memory.id}`,
      })
    }

    return memory
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown memory create failure"
    if (auditId) {
      await completeToolCallAudit({ id: auditId, status: "error", error: safeMessage })
    }

    throw error
  }
}
