import pool from "@/lib/db"
import type { ToolCallStatus, ToolType } from "@/lib/tools/types"

export async function createToolCallAudit(input: {
  toolName: string
  toolType: ToolType
  status?: ToolCallStatus
  payload?: unknown
}) {
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO aeon_tool_calls (tool_name, tool_type, status, input)
    VALUES ($1, $2, $3, $4)
    RETURNING id
    `,
    [input.toolName, input.toolType, input.status ?? "running", input.payload ? JSON.stringify(input.payload) : null],
  )

  return result.rows[0]?.id
}

export async function completeToolCallAudit(input: {
  id: string
  status: Extract<ToolCallStatus, "success" | "error">
  outputSummary?: string
  error?: string
}) {
  await pool.query(
    `
    UPDATE aeon_tool_calls
    SET status = $2,
        output_summary = $3,
        error = $4,
        completed_at = now()
    WHERE id = $1
    `,
    [input.id, input.status, input.outputSummary ?? null, input.error ?? null],
  )
}
