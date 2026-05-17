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

async function getDriveImportsState() {
  try {
    const [latestJob, indexedDocs] = await Promise.all([
      pool.query<{ status: string; imported_count: string; failed_count: string }>(
        `
        SELECT status, imported_count::text, failed_count::text
        FROM drive_import_jobs
        ORDER BY started_at DESC
        LIMIT 1
        `,
      ),
      pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM documents
        WHERE source = 'google_drive' AND status = 'indexed'
        `,
      ),
    ])

    const latest = latestJob.rows[0]
    const indexedCount = Number(indexedDocs.rows[0]?.count || "0")

    if (!latest) {
      return {
        enabled: false,
        message: "No Drive import jobs yet. Run CLI ingestion.",
      }
    }

    const imported = Number(latest.imported_count || "0")
    const failed = Number(latest.failed_count || "0")

    return {
      enabled: latest.status === "success" || latest.status === "partial" || indexedCount > 0,
      message: `latest=${latest.status}, indexed=${indexedCount}, imported=${imported}, failed=${failed}`,
    }
  } catch {
    return {
      enabled: false,
      message: "Drive imports not configured yet.",
    }
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
  const driveImports = await getDriveImportsState()

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
        name: "drive_imports",
        type: "drive_imports",
        label: "Drive Imports",
        status: driveImports.enabled ? "enabled" : "disabled",
        configured: driveImports.enabled,
        message: driveImports.message,
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
