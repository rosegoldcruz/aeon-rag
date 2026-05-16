import { NextResponse } from "next/server"
import { retrieveContext } from "@/lib/retrieve"

type SearchRequest = {
  query?: unknown
  topK?: unknown
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
  const topK = typeof body.topK === "number" && Number.isFinite(body.topK) ? Math.max(1, Math.min(body.topK, 10)) : 5

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
    const result = await retrieveContext(query, topK)

    return NextResponse.json({
      ok: true,
      context: result.context,
      sources: result.sources,
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