import { access } from "node:fs/promises"
import { constants } from "node:fs"
import { NextResponse } from "next/server"
import { isCurrentRequestAdminAuthenticated } from "@/lib/admin-portal"
import { getPool } from "@/lib/db"

async function canWrite(path: string) {
  try {
    await access(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

export async function GET() {
  const adminState = await isCurrentRequestAdminAuthenticated()
  if (!adminState.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let database = "connected"
  try {
    await getPool().query("SELECT 1")
  } catch {
    database = "error"
  }

  const integrations = {
    postgres: {
      configured: Boolean(process.env.POSTGRES_URL),
      status: database,
      note: database === "connected" ? "Database reachable" : "Database query failed",
    },
    nocodb: {
      configured: Boolean(process.env.NOCODB_URL),
      status: process.env.NOCODB_URL ? "configured" : "missing",
      note: process.env.NOCODB_URL ? "NocoDB URL configured" : "NocoDB URL env not set",
    },
    n8n: {
      configured: Boolean(process.env.N8N_URL),
      status: process.env.N8N_URL ? "configured" : "missing",
      note: process.env.N8N_URL ? "n8n URL configured" : "n8n URL env not set",
    },
    aiProvider: {
      configured: Boolean(process.env.DEEPSEEK_API_KEY),
      status: process.env.DEEPSEEK_API_KEY ? "configured" : "missing",
      note: process.env.DEEPSEEK_API_KEY ? "DeepSeek API key configured" : "DEEPSEEK_API_KEY not set",
    },
    outlook: {
      configured: Boolean(process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID),
      status: process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID ? "configured" : "missing",
      note:
        process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID
          ? "Outlook client ID found"
          : "Outlook client ID env not set",
    },
    fileStorage: {
      configured: true,
      status: (await canWrite("/var/lib/aeonops/uploads")) ? "writable" : "readonly_or_missing",
      note: "/var/lib/aeonops/uploads",
    },
  }

  return NextResponse.json({ ok: true, integrations })
}
