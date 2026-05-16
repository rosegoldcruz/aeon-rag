import pool from "@/lib/db"
import { embedText } from "@/lib/embed"

export async function retrieveContext(query: string, topK = 5): Promise<{
  context: string
  sources: Array<{ documentName: string; content: string; score?: number }>
}> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { context: "", sources: [] }
  }

  try {
    const queryEmbedding = await embedText(trimmed)
    const vectorLiteral = `[${queryEmbedding.join(",")}]`

    const result = await pool.query<{
      content: string
      source: string
      distance: number
    }>(
      `
      SELECT
        c.content,
        d.name AS source,
        c.embedding <=> $1::vector AS distance
      FROM chunks c
      JOIN documents d ON c.document_id = d.id
      WHERE c.embedding IS NOT NULL
        AND d.status = 'indexed'
      ORDER BY c.embedding <=> $1::vector
      LIMIT $2
      `,
      [vectorLiteral, topK],
    )

    if (result.rows.length === 0) {
      return { context: "", sources: [] }
    }

    const sources = result.rows
      .map((row) => ({
      documentName: row.source,
      content: row.content,
      score: 1 - Number(row.distance),
      }))
      .filter((row) => (row.score ?? 0) >= 0.6)

    if (sources.length === 0) {
      return { context: "", sources: [] }
    }

    const context = sources.map((row) => `[Source: ${row.documentName}]\n${row.content}`).join("\n\n")

    return { context, sources }
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown retrieval failure"
    console.error("[retrieve] retrieval failed", { message: safeMessage })
    return { context: "", sources: [] }
  }
}