import { NextResponse } from "next/server"
import { searchSimilarChunks } from "@/lib/rag/db"
import { embedText } from "@/lib/rag/text"

type SearchRequest = {
  query?: unknown
  limit?: unknown
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  let body: SearchRequest

  try {
    body = (await request.json()) as SearchRequest
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid JSON payload.",
      },
      { status: 400 },
    )
  }

  const query = typeof body.query === "string" ? body.query.trim() : ""
  const limit = typeof body.limit === "number" && Number.isFinite(body.limit) ? Math.max(1, Math.min(body.limit, 10)) : 5

  if (!query) {
    return NextResponse.json(
      {
        ok: false,
        error: "Query is required.",
      },
      { status: 400 },
    )
  }

  try {
    const queryEmbedding = await embedText(query)
    const chunks = await searchSimilarChunks(queryEmbedding, limit)

    return NextResponse.json({
      ok: true,
      query,
      chunks,
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown RAG search failure"
    console.error("[api/rag/search] search failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run retrieval search.",
      },
      { status: 500 },
    )
  }
}