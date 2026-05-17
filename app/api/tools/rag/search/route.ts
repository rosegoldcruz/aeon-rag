import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { runDocumentSearch } from "@/lib/tools/document-tool"

type SearchRequest = {
  query?: unknown
  topK?: unknown
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

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
  const topK = typeof body.topK === "number" && Number.isFinite(body.topK) ? body.topK : 5

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
    const result = await runDocumentSearch(query, topK)

    return NextResponse.json({
      ok: true,
      context: result.context,
      sources: result.sources,
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown Documents/RAG search failure"
    console.error("[api/tools/rag/search] search failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to run Documents/RAG search.",
      },
      { status: 500 },
    )
  }
}
