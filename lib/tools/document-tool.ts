import { getRagStats } from "@/lib/rag/db"
import { retrieveContext } from "@/lib/retrieve"
import { completeToolCallAudit, createToolCallAudit } from "@/lib/tools/audit"

export async function getDocumentToolStatus() {
  const auditId = await createToolCallAudit({
    toolName: "rag.status",
    toolType: "documents_rag",
  })

  try {
    const stats = await getRagStats()
    const enabled = stats.indexedDocuments > 0 && stats.chunks > 0

    if (auditId) {
      await completeToolCallAudit({
        id: auditId,
        status: "success",
        outputSummary: `documents=${stats.documents}, indexed=${stats.indexedDocuments}, chunks=${stats.chunks}`,
      })
    }

    return {
      ok: true as const,
      enabled,
      stats,
      message: enabled ? "Documents/RAG is enabled." : "Documents are available but not fully indexed yet.",
    }
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown RAG status failure"
    if (auditId) {
      await completeToolCallAudit({
        id: auditId,
        status: "error",
        error: safeMessage,
      })
    }

    throw error
  }
}

export async function runDocumentSearch(query: string, topK = 5) {
  const trimmed = query.trim()
  const limitedTopK = Math.max(1, Math.min(topK, 10))

  const auditId = await createToolCallAudit({
    toolName: "rag.search",
    toolType: "documents_rag",
    payload: {
      query: trimmed,
      topK: limitedTopK,
    },
  })

  try {
    const result = await retrieveContext(trimmed, limitedTopK)

    if (auditId) {
      await completeToolCallAudit({
        id: auditId,
        status: "success",
        outputSummary: `sources=${result.sources.length}`,
      })
    }

    return result
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown RAG search failure"

    if (auditId) {
      await completeToolCallAudit({
        id: auditId,
        status: "error",
        error: safeMessage,
      })
    }

    throw error
  }
}
