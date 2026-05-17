import { mkdir, writeFile } from "node:fs/promises"
import { extname, basename } from "node:path"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { ingestStoredFile } from "@/lib/ingest"

const MAX_FILE_SIZE = 20 * 1024 * 1024
const UPLOAD_DIR = "/home/aeon-rag/storage/uploads"
const INLINE_INGEST_EXTENSIONS = new Set([".txt", ".md", ".json", ".csv", ".pdf"])
const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".txt",
  ".md",
  ".json",
  ".csv",
  ".doc",
  ".docx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
])

function sanitizeFileName(name: string) {
  const base = basename(name)
  return base.replace(/[^a-zA-Z0-9._-]/g, "_")
}

export const runtime = "nodejs"

export async function POST(request: Request) {
  const session = await getAuthenticatedSession()

  if (!session) {
    return unauthorizedResponse()
  }

  let formData: FormData

  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid multipart form data.",
      },
      { status: 400 },
    )
  }

  const file = formData.get("file")
  if (!(file instanceof File)) {
    return NextResponse.json(
      {
        ok: false,
        error: "A file field is required.",
      },
      { status: 400 },
    )
  }

  if (!file.name || file.size === 0) {
    return NextResponse.json(
      {
        ok: false,
        error: "Uploaded file is empty.",
      },
      { status: 400 },
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      {
        ok: false,
        error: "File exceeds 20MB limit.",
      },
      { status: 413 },
    )
  }

  const sanitized = sanitizeFileName(file.name)
  const extension = extname(sanitized).toLowerCase()
  if (!ALLOWED_EXTENSIONS.has(extension)) {
    return NextResponse.json(
      {
        ok: false,
        error: "Unsupported file type.",
      },
      { status: 415 },
    )
  }

  const id = randomUUID()
  const storedName = `${id}-${sanitized}`
  const storagePath = `${UPLOAD_DIR}/${storedName}`
  const relativeStoredPath = `storage/uploads/${storedName}`

  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
    const bytes = Buffer.from(await file.arrayBuffer())
    await writeFile(storagePath, bytes)
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown upload failure"
    console.error("[api/files/upload] Upload failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to persist uploaded file.",
      },
      { status: 500 },
    )
  }

  let ingested = false
  let ingestError = ""
  let documentId: string | undefined
  let chunkCount = 0
  let status: "uploaded" | "indexed" | "failed" = "uploaded"
  const fileType = file.type || extension.replace(".", "") || "application/octet-stream"

  if (INLINE_INGEST_EXTENSIONS.has(extension)) {
    try {
      const ingestedResult = await ingestStoredFile({
        storedPath: relativeStoredPath,
        name: sanitized,
        type: fileType,
        sizeBytes: file.size,
      })

      ingested = true
      documentId = ingestedResult.documentId
      chunkCount = ingestedResult.chunkCount
      status = "indexed"
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : "Unknown indexing failure"
      ingestError = safeMessage

      if (
        safeMessage.includes("Unsupported file type") ||
        safeMessage.includes("coming next") ||
        safeMessage.includes("No chunks")
      ) {
        status = "uploaded"
      } else {
        status = "failed"
      }
    }
  } else {
    ingestError = "Inline parsing for this file type is coming next."
    status = "uploaded"
  }

  return NextResponse.json({
    ok: true,
    file: {
      id,
      name: sanitized,
      size: file.size,
      type: fileType,
      storedPath: relativeStoredPath,
      status,
    },
    ingested,
    documentId,
    chunkCount,
    ...(ingested ? {} : { ingestError }),
  })
}