import { mkdir, writeFile } from "node:fs/promises"
import { extname, basename } from "node:path"
import { randomUUID } from "node:crypto"
import { NextResponse } from "next/server"
import { createDocument, replaceDocumentChunks, updateDocumentStatus } from "@/lib/rag/db"
import { chunkText, embedChunks, extractTextFromStoredFile } from "@/lib/rag/text"

const MAX_FILE_SIZE = 20 * 1024 * 1024
const UPLOAD_DIR = "/home/aeon-rag/storage/uploads"
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
  const absoluteStoredPath = `/home/aeon-rag/${relativeStoredPath}`
  let documentId: string | null = null

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

  try {
    const document = await createDocument({
      originalName: sanitized,
      storedPath: relativeStoredPath,
      mimeType: file.type || extension.replace(".", "") || "application/octet-stream",
      sizeBytes: file.size,
      status: "uploaded",
    })
    documentId = document.id
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown document insert failure"
    console.error("[api/files/upload] Document registration failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "File saved, but failed to register in document index.",
      },
      { status: 500 },
    )
  }

  let status: "uploaded" | "indexed" | "failed" = "uploaded"
  let indexingMessage = ""
  let chunkCount = 0

  try {
    const parsed = await extractTextFromStoredFile(absoluteStoredPath, sanitized)

    if (!parsed.supported || !parsed.text) {
      status = "uploaded"
      indexingMessage = parsed.message || "Parsing for this format is coming next."
    } else {
      const chunks = chunkText(parsed.text)

      if (chunks.length === 0) {
        status = "failed"
        indexingMessage = "No extractable text found for indexing."
        if (documentId) {
          await updateDocumentStatus(documentId, "failed")
        }
      } else {
        const embeddings = await embedChunks(chunks)

        if (documentId) {
          await replaceDocumentChunks(
            documentId,
            chunks.map((content, chunkIndex) => ({
              chunkIndex,
              content,
              embedding: embeddings[chunkIndex],
            })),
          )
          await updateDocumentStatus(documentId, "indexed")
        }

        status = "indexed"
        chunkCount = chunks.length
        indexingMessage = `Indexed ${chunkCount} chunks for retrieval.`
      }
    }
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown indexing failure"
    console.error("[api/files/upload] Indexing failed", { message: safeMessage })
    status = "failed"
    indexingMessage = "Indexing failed."

    if (documentId) {
      await updateDocumentStatus(documentId, "failed")
    }
  }

  return NextResponse.json({
    ok: true,
    file: {
      id: documentId || id,
      name: sanitized,
      size: file.size,
      type: file.type || extension.replace(".", "") || "application/octet-stream",
      storedPath: relativeStoredPath,
      status,
      chunkCount,
      indexingMessage,
    },
  })
}