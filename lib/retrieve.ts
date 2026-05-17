import pool from "@/lib/db"
import { embedText } from "@/lib/embed"

export async function retrieveContext(query: string, topK = 5): Promise<{
  context: string
  retrievalMode: "vector" | "keyword_fallback" | "none"
  sources: Array<{
    documentName: string
    originalName: string
    chunkIndex: number
    content: string
    score?: number
    mode: "vector" | "keyword_fallback"
  }>
}> {
  const trimmed = query.trim()
  if (!trimmed) {
    return { context: "", retrievalMode: "none", sources: [] }
  }

  const limitedTopK = Math.max(1, Math.min(topK, 20))

  const terms = trimmed
    .split(/\s+/)
    .map((term) => term.replace(/[^a-zA-Z0-9_-]/g, "").trim())
    .filter((term) => term.length >= 3)
    .slice(0, 10)

  const runKeywordFallback = async () => {
    if (terms.length === 0) {
      return {
        context: "",
        retrievalMode: "none" as const,
        sources: [],
      }
    }

    const result = await pool.query<{
      content: string
      document_name: string
      original_name: string
      chunk_index: number
      matched_terms: number
    }>(
      `
      SELECT
        dc.content,
        COALESCE(d.original_name, d.name, 'unknown') AS document_name,
        COALESCE(d.original_name, d.name, 'unknown') AS original_name,
        dc.chunk_index,
        (
          SELECT COUNT(*)
          FROM unnest($1::text[]) AS term
          WHERE dc.content ILIKE ('%' || term || '%')
        )::int AS matched_terms
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE d.status = 'indexed'
        AND EXISTS (
          SELECT 1
          FROM unnest($1::text[]) AS term
          WHERE dc.content ILIKE ('%' || term || '%')
        )
      ORDER BY matched_terms DESC, d.created_at DESC, dc.chunk_index ASC
      LIMIT $2
      `,
      [terms, limitedTopK],
    )

    if (result.rows.length === 0) {
      return {
        context: "",
        retrievalMode: "none" as const,
        sources: [],
      }
    }

    const sources = result.rows.map((row) => ({
      documentName: row.document_name,
      originalName: row.original_name,
      chunkIndex: Number(row.chunk_index),
      content: row.content,
      score: Number(row.matched_terms),
      mode: "keyword_fallback" as const,
    }))

    return {
      context: sources.map((row) => `[Source: ${row.documentName} #${row.chunkIndex}]\n${row.content}`).join("\n\n"),
      retrievalMode: "keyword_fallback" as const,
      sources,
    }
  }

  try {
    const queryEmbedding = await embedText(trimmed)
    const vectorLiteral = `[${queryEmbedding.join(",")}]`

    const result = await pool.query<{
      content: string
      source: string
      original_name: string
      chunk_index: number
      distance: number
    }>(
      `
      SELECT
        dc.content,
        COALESCE(d.original_name, d.name, 'unknown') AS source,
        COALESCE(d.original_name, d.name, 'unknown') AS original_name,
        dc.chunk_index,
        dc.embedding <=> $1::vector AS distance
      FROM document_chunks dc
      JOIN documents d ON dc.document_id = d.id
      WHERE dc.embedding IS NOT NULL
        AND d.status = 'indexed'
      ORDER BY dc.embedding <=> $1::vector
      LIMIT $2
      `,
      [vectorLiteral, limitedTopK],
    )

    if (result.rows.length === 0) {
      return runKeywordFallback()
    }

    const sources = result.rows.map((row) => ({
      documentName: row.source,
      originalName: row.original_name,
      chunkIndex: Number(row.chunk_index),
      content: row.content,
      score: 1 - Number(row.distance),
      mode: "vector" as const,
    }))

    const context = sources.map((row) => `[Source: ${row.documentName} #${row.chunkIndex}]\n${row.content}`).join("\n\n")

    return { context, retrievalMode: "vector", sources }
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown retrieval failure"
    console.error("[retrieve] retrieval failed", { message: safeMessage })

    try {
      return await runKeywordFallback()
    } catch (fallbackError) {
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "Unknown fallback retrieval failure"
      console.error("[retrieve] keyword fallback failed", { message: fallbackMessage })
      return { context: "", retrievalMode: "none", sources: [] }
    }
  }
}