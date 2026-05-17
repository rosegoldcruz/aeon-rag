import { NextResponse } from "next/server"

import { getRagStats } from "@/lib/rag/db"

export const runtime = "nodejs"

export async function GET() {
  try {
    const stats = await getRagStats()

    return NextResponse.json({
      ok: true,
      ...stats,
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown RAG status failure"
    console.error("[api/rag/status] status failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to read RAG status.",
      },
      { status: 500 },
    )
  }
}