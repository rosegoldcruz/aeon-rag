export type ToolStatus = "enabled" | "disabled" | "coming_soon"

export type ToolType = "documents_rag" | "memory" | "vision" | "image_generation" | "github" | "mcp_servers"

export type ToolRegistryEntry = {
  name: string
  type: ToolType
  label: string
  status: ToolStatus
  configured: boolean
  message?: string
}

export type ToolCallStatus = "queued" | "running" | "success" | "error"

export type RuntimeStoragePaths = {
  root: string
  driveManifests: string
  driveImports: string
  driveExtracted: string
  driveFailed: string
  uploads: string
  toolRuns: string
  memory: string
}

const DEFAULT_RUNTIME_ROOT = "/var/lib/aeonops"

export function getRuntimeStoragePaths(): RuntimeStoragePaths {
  const root = process.env.AEON_RUNTIME_ROOT?.trim() || DEFAULT_RUNTIME_ROOT

  return {
    root,
    driveManifests: `${root}/drive/manifests`,
    driveImports: `${root}/drive/imports`,
    driveExtracted: `${root}/drive/extracted`,
    driveFailed: `${root}/drive/failed`,
    uploads: `${root}/uploads`,
    toolRuns: `${root}/tool-runs`,
    memory: `${root}/memory`,
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value || !value.trim()) {
    throw new Error(`Missing required env var: ${name}`)
  }

  return value
}
