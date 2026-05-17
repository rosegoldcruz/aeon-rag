import { access } from "node:fs/promises"
import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import pool from "@/lib/db"

const MODELS = [
  { id: "gemini-2.5-flash", label: "AEON / Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", label: "AEON / Gemini 2.5 Pro" },
  { id: "gemini-1.5-pro", label: "AEON / Gemini 1.5 Pro" },
  { id: "gemini-1.5-flash", label: "AEON / Gemini 1.5 Flash" },
  { id: "gemini-2.0-flash", label: "AEON / Gemini 2.0 Flash" },
]

export const runtime = "nodejs"

export async function GET() {
  const session = await getAuthenticatedSession()

  if (!session) {
    return unauthorizedResponse()
  }

  const uploadPath = "/home/aeon-rag/storage/uploads"
  let uploadReady = false

  try {
    await access(uploadPath)
    uploadReady = true
  } catch {
    uploadReady = false
  }

  let ragStats = { indexedDocuments: 0, chunks: 0 }

  try {
    const [indexedDocuments, chunks] = await Promise.all([
      pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM documents WHERE status = 'indexed'"),
      pool.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM chunks"),
    ])

    ragStats = {
      indexedDocuments: Number(indexedDocuments.rows[0]?.count || "0"),
      chunks: Number(chunks.rows[0]?.count || "0"),
    }
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown RAG stats error"
    console.error("[api/models] RAG status read failed", { message: safeMessage })
  }

  const retrievalEnabled = ragStats.indexedDocuments > 0 && ragStats.chunks > 0

  return NextResponse.json({
    ok: true,
    models: MODELS,
    selected: process.env.VERTEX_MODEL || "gemini-2.5-flash",
    status: {
      vertexProjectConfigured: Boolean(process.env.GOOGLE_VERTEX_PROJECT),
      vertexLocationConfigured: Boolean(process.env.GOOGLE_VERTEX_LOCATION),
      vertexProject: process.env.GOOGLE_VERTEX_PROJECT ? "configured" : "not configured",
      vertexLocation: process.env.GOOGLE_VERTEX_LOCATION ? "configured" : "not configured",
      voiceInput: "browser-dependent",
      uploadStorage: uploadReady ? "enabled" : "ready-on-first-upload",
      ragIngestion: retrievalEnabled ? "enabled" : "coming next",
      knowledgeRetrieval: retrievalEnabled ? "enabled" : "not indexed yet",
      indexedDocuments: ragStats.indexedDocuments,
      indexedChunks: ragStats.chunks,
    },
  })
}