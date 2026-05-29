import { retrieveContext } from "@/lib/retrieve"
import {
  AEON_TOOL_KEYS,
  AEON_TOOL_LABELS,
  DEFAULT_AEON_TOOL_TOGGLES,
  type AeonToolKey,
  type AeonToolToggles,
  type AeonToolTraceItem,
} from "@/lib/aeon-tool-types"

export type AeonToolRouterResult = {
  contextBlocks: string[]
  sources: Array<{ documentName: string; content: string; score?: number }>
  usedTools: AeonToolTraceItem[]
  unavailableTools: AeonToolTraceItem[]
  toolErrors: AeonToolTraceItem[]
}

export function normalizeAeonToolToggles(input: unknown): AeonToolToggles {
  if (!input || typeof input !== "object") {
    return { ...DEFAULT_AEON_TOOL_TOGGLES }
  }

  const value = input as Record<string, unknown>
  return AEON_TOOL_KEYS.reduce<AeonToolToggles>(
    (next, key) => ({
      ...next,
      [key]: value[key] === true,
    }),
    { ...DEFAULT_AEON_TOOL_TOGGLES },
  )
}

function unavailable(key: AeonToolKey, message: string): AeonToolTraceItem {
  return {
    key,
    label: AEON_TOOL_LABELS[key],
    message,
  }
}

export async function runAeonToolRouter(input: {
  message: string
  tools: AeonToolToggles
  failOpen?: boolean
}): Promise<AeonToolRouterResult> {
  const failOpen = input.failOpen !== false
  const result: AeonToolRouterResult = {
    contextBlocks: [],
    sources: [],
    usedTools: [],
    unavailableTools: [],
    toolErrors: [],
  }

  if (input.tools.rag) {
    try {
      const retrieved = await retrieveContext(input.message, 5)

      if (retrieved.context) {
        result.contextBlocks.push(
          "Relevant context from RAG / Knowledge Base:\n" +
            retrieved.context +
            "\n\nUse this context where relevant. If the context does not answer the question, say so and answer from general reasoning. Include sources when practical.",
        )
        result.sources = retrieved.sources
        result.usedTools.push({
          key: "rag",
          label: AEON_TOOL_LABELS.rag,
          message: `Retrieved ${retrieved.sources.length} source${retrieved.sources.length === 1 ? "" : "s"}.`,
        })
      } else {
        result.usedTools.push({
          key: "rag",
          label: AEON_TOOL_LABELS.rag,
          message: "No matching knowledge context found.",
        })
      }
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "Unknown RAG failure"
      console.error("[aeon-tools] RAG failed", { message: safeMessage })
      result.toolErrors.push({
        key: "rag",
        label: AEON_TOOL_LABELS.rag,
        message: "RAG failed: continued without knowledge context.",
      })

      if (!failOpen) {
        throw error
      }
    }
  }

  if (input.tools.googleDrive) {
    result.unavailableTools.push(
      unavailable("googleDrive", "Google Drive search is unavailable: no verified Drive-only search connector found. Indexed Drive content can be searched through RAG when RAG is enabled."),
    )
  }

  if (input.tools.websiteSearch) {
    result.unavailableTools.push(unavailable("websiteSearch", "Website Search is unavailable: no verified website search connector found."))
  }

  if (input.tools.nocodb) {
    result.unavailableTools.push(unavailable("nocodb", "CRM / NocoDB is unavailable: no verified chat-safe CRM query connector found."))
  }

  if (input.tools.calendar) {
    result.unavailableTools.push(unavailable("calendar", "Calendar is unavailable: no verified calendar connector found."))
  }

  if (input.tools.email) {
    result.unavailableTools.push(unavailable("email", "Email is unavailable: no verified email connector found."))
  }

  if (input.tools.files) {
    result.unavailableTools.push(unavailable("files", "Files is unavailable: uploaded file content is available through RAG after indexing."))
  }

  if (input.tools.codebase) {
    result.unavailableTools.push(unavailable("codebase", "Codebase is unavailable: no verified runtime code search connector found."))
  }

  if (input.tools.adminOps) {
    result.unavailableTools.push(unavailable("adminOps", "Admin Ops is unavailable: no verified chat-safe admin ops connector found."))
  }

  return result
}