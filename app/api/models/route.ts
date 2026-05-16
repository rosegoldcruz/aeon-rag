import { access } from "node:fs/promises"
import { NextResponse } from "next/server"

const MODELS = [
  { id: "gemini-1.5-pro", label: "AEON / Gemini 1.5 Pro" },
  { id: "gemini-1.5-flash", label: "AEON / Gemini 1.5 Flash" },
  { id: "gemini-2.0-flash", label: "AEON / Gemini 2.0 Flash" },
  { id: "gemini-2.5-flash", label: "AEON / Gemini 2.5 Flash" },
]

export const runtime = "nodejs"

export async function GET() {
  const uploadPath = "/home/aeon-rag/storage/uploads"
  let uploadReady = false

  try {
    await access(uploadPath)
    uploadReady = true
  } catch {
    uploadReady = false
  }

  return NextResponse.json({
    ok: true,
    models: MODELS,
    selected: process.env.VERTEX_MODEL || "gemini-1.5-pro",
    status: {
      vertexProjectConfigured: Boolean(process.env.GOOGLE_VERTEX_PROJECT),
      vertexLocationConfigured: Boolean(process.env.GOOGLE_VERTEX_LOCATION),
      vertexProject: process.env.GOOGLE_VERTEX_PROJECT ? "configured" : "not configured",
      vertexLocation: process.env.GOOGLE_VERTEX_LOCATION ? "configured" : "not configured",
      voiceInput: "browser-dependent",
      uploadStorage: uploadReady ? "enabled" : "ready-on-first-upload",
      ragIngestion: "coming next",
    },
  })
}