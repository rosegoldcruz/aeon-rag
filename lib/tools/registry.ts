import pool from "@/lib/db"
import { getDocumentToolStatus } from "@/lib/tools/document-tool"
import { getRuntimeStoragePaths, type ToolRegistryEntry } from "@/lib/tools/types"

async function isMemoryToolEnabled() {
  try {
    await pool.query("SELECT 1 FROM aeon_memories LIMIT 1")
    return true
  } catch {
    return false
  }
}

export async function getToolRegistry(): Promise<{
  runtimePaths: ReturnType<typeof getRuntimeStoragePaths>
  tools: ToolRegistryEntry[]
}> {
  const runtimePaths = getRuntimeStoragePaths()

  let documentsEnabled = false
  let documentsMessage = "Documents/RAG is not configured."

  try {
    const status = await getDocumentToolStatus()
    documentsEnabled = status.enabled
    documentsMessage = status.message
  } catch (error) {
    const safe = error instanceof Error ? error.message : "Failed to query Documents/RAG status"
    documentsMessage = safe
  }

  const memoryEnabled = await isMemoryToolEnabled()

  return {
    runtimePaths,
    tools: [
      {
        name: "documents",
        type: "documents_rag",
        label: "Documents/RAG",
        status: documentsEnabled ? "enabled" : "disabled",
        configured: documentsEnabled,
        message: documentsMessage,
      },
      {
        name: "memory",
        type: "memory",
        label: "Memory",
        status: memoryEnabled ? "enabled" : "disabled",
        configured: memoryEnabled,
        message: memoryEnabled ? "Memory is enabled." : "Memory is not configured.",
      },
      {
        name: "vision",
        type: "vision",
        label: "Vision",
        status: "coming_soon",
        configured: false,
        message: "Coming soon",
      },
      {
        name: "image_generation",
        type: "image_generation",
        label: "Image Generation",
        status: "coming_soon",
        configured: false,
        message: "Coming soon",
      },
      {
        name: "github",
        type: "github",
        label: "GitHub",
        status: "coming_soon",
        configured: false,
        message: "Coming soon",
      },
      {
        name: "mcp_servers",
        type: "mcp_servers",
        label: "MCP Servers",
        status: "coming_soon",
        configured: false,
        message: "Coming soon",
      },
    ],
  }
}
