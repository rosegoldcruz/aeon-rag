import { access } from "node:fs/promises"
import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { DEEPSEEK_BASE_URL, DEEPSEEK_MODELS, getDefaultDeepSeekModel } from "@/lib/deepseek"
import { getRagStats } from "@/lib/rag/db"

const MODELS = DEEPSEEK_MODELS

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
    const stats = await getRagStats()
    ragStats = {
      indexedDocuments: stats.indexedDocuments,
      chunks: stats.chunks,
    }
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown RAG stats error"
    console.error("[api/models] RAG status read failed", { message: safeMessage })
  }

  const retrievalEnabled = ragStats.indexedDocuments > 0 && ragStats.chunks > 0

  return NextResponse.json({
    ok: true,
    models: MODELS,
    selected: getDefaultDeepSeekModel(),
    status: {
      aiProviderConfigured: Boolean(process.env.DEEPSEEK_API_KEY),
      aiProvider: process.env.DEEPSEEK_API_KEY ? "DeepSeek configured" : "DeepSeek not configured",
      aiProviderBaseURL: DEEPSEEK_BASE_URL,
      voiceInput: "browser-dependent",
      uploadStorage: uploadReady ? "enabled" : "ready-on-first-upload",
      ragIngestion: retrievalEnabled ? "enabled" : "coming next",
      knowledgeRetrieval: retrievalEnabled ? "enabled" : "not indexed yet",
      indexedDocuments: ragStats.indexedDocuments,
      indexedChunks: ragStats.chunks,
    },
  })
}