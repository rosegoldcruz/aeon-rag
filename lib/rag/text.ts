import { readFile } from "node:fs/promises"
import { extname } from "node:path"
import { embedTextLocally, LOCAL_EMBEDDING_DIMENSION, LOCAL_EMBEDDING_MODEL_ID } from "@/lib/local-embeddings"

export const EMBEDDING_MODEL = process.env.RAG_EMBED_MODEL || LOCAL_EMBEDDING_MODEL_ID
export const EMBEDDING_DIMENSION = LOCAL_EMBEDDING_DIMENSION

export type ParsedFile = {
  supported: boolean
  message?: string
  text?: string
}

export async function extractTextFromStoredFile(storedAbsolutePath: string, originalName: string): Promise<ParsedFile> {
  const extension = extname(originalName).toLowerCase()

  if (extension === ".pdf" || extension === ".doc" || extension === ".docx") {
    return {
      supported: false,
      message: "Parsing for this format is coming next.",
    }
  }

  if (![".txt", ".md", ".json", ".csv"].includes(extension)) {
    return {
      supported: false,
      message: "Parsing for this format is coming next.",
    }
  }

  const raw = await readFile(storedAbsolutePath, "utf8")

  if (extension === ".json") {
    try {
      const parsed = JSON.parse(raw)
      return {
        supported: true,
        text: JSON.stringify(parsed, null, 2),
      }
    } catch {
      return {
        supported: true,
        text: raw,
      }
    }
  }

  return {
    supported: true,
    text: raw,
  }
}

export function chunkText(text: string, chunkSize = 900, overlap = 120) {
  const normalized = text.replace(/\r\n/g, "\n").trim()
  if (!normalized) {
    return []
  }

  const chunks: string[] = []
  let cursor = 0

  while (cursor < normalized.length) {
    const end = Math.min(cursor + chunkSize, normalized.length)
    const chunk = normalized.slice(cursor, end).trim()
    if (chunk) {
      chunks.push(chunk)
    }

    if (end >= normalized.length) {
      break
    }

    cursor = Math.max(0, end - overlap)
  }

  return chunks
}

export async function embedText(value: string) {
  const embedding = embedTextLocally(value)

  if (embedding.length !== EMBEDDING_DIMENSION) {
    throw new Error(
      `Unexpected embedding dimension: got ${embedding.length}, expected ${EMBEDDING_DIMENSION}.`,
    )
  }

  return embedding
}

export async function embedChunks(chunks: string[]) {
  const embeddings: number[][] = []

  for (const chunk of chunks) {
    const embedding = await embedText(chunk)
    embeddings.push(embedding)
  }

  return embeddings
}