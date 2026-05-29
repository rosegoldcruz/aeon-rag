export const AEON_TOOL_KEYS = [
  "rag",
  "googleDrive",
  "websiteSearch",
  "nocodb",
  "calendar",
  "email",
  "files",
  "codebase",
  "adminOps",
] as const

export type AeonToolKey = (typeof AEON_TOOL_KEYS)[number]

export type AeonToolToggles = Record<AeonToolKey, boolean>

export type AeonToolTraceItem = {
  key: AeonToolKey
  label: string
  message?: string
}

export type AeonToolTrace = {
  usedTools: AeonToolTraceItem[]
  unavailableTools: AeonToolTraceItem[]
  toolErrors: AeonToolTraceItem[]
}

export const AEON_TOOL_LABELS: Record<AeonToolKey, string> = {
  rag: "RAG / Knowledge Base",
  googleDrive: "Google Drive",
  websiteSearch: "Website Search",
  nocodb: "CRM / NocoDB",
  calendar: "Calendar",
  email: "Email",
  files: "Files",
  codebase: "Codebase",
  adminOps: "Admin Ops",
}

export const DEFAULT_AEON_TOOL_TOGGLES: AeonToolToggles = {
  rag: false,
  googleDrive: false,
  websiteSearch: false,
  nocodb: false,
  calendar: false,
  email: false,
  files: false,
  codebase: false,
  adminOps: false,
}