export const MAX_EMBEDDING_CHUNK_CHARS = 4000

function splitOversizedChunk(chunk: string, maxChunkChars: number): string[] {
  if (chunk.length <= maxChunkChars) {
    return [chunk]
  }

  const parts: string[] = []
  let start = 0

  while (start < chunk.length) {
    const part = chunk.slice(start, start + maxChunkChars).trim()
    if (part.length > 50) {
      parts.push(part)
    }
    start += maxChunkChars
  }

  return parts
}

export function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()

  if (!normalized) {
    return []
  }

  const chunks: string[] = []
  const safeChunkSize = Math.min(chunkSize, MAX_EMBEDDING_CHUNK_CHARS)
  const safeOverlap = Math.min(overlap, Math.max(0, safeChunkSize - 1))
  const step = Math.max(1, safeChunkSize - safeOverlap)
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + safeChunkSize, normalized.length)
    const chunk = normalized.slice(start, end).trim()

    if (chunk.length > 50) {
      chunks.push(...splitOversizedChunk(chunk, MAX_EMBEDDING_CHUNK_CHARS))
    }

    if (end >= normalized.length) {
      break
    }

    start += step
  }

  return chunks
}