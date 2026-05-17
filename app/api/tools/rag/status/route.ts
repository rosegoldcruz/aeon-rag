import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { getDocumentToolStatus } from "@/lib/tools/document-tool"

export const runtime = "nodejs"

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  try {
    const result = await getDocumentToolStatus()
    return NextResponse.json({
      ok: true,
      enabled: result.enabled,
      message: result.message,
      ...result.stats,
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown Documents/RAG status failure"
    console.error("[api/tools/rag/status] status failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to read Documents/RAG status.",
      },
      { status: 500 },
    )
  }
}
