export function chunkText(text: string, chunkSize = 1500, overlap = 200): string[] {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()

  if (!normalized) {
    return []
  }

  const chunks: string[] = []
  const step = Math.max(1, chunkSize - overlap)
  let start = 0

  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length)
    const chunk = normalized.slice(start, end).trim()

    if (chunk.length > 50) {
      chunks.push(chunk)
    }

    if (end >= normalized.length) {
      break
    }

    start += step
  }

  return chunks
}