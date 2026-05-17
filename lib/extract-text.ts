import { access, readFile } from "node:fs/promises"
import { extname } from "node:path"
import { PDFParse } from "pdf-parse"

const MAX_TEXT_BYTES = 20 * 1024 * 1024

export async function extractTextFromFile(filePath: string, mimeType?: string): Promise<string> {
  await access(filePath)

  const extension = extname(filePath).toLowerCase()
  const raw = await readFile(filePath)

  if (raw.byteLength > MAX_TEXT_BYTES) {
    throw new Error("File too large for inline extraction.")
  }

  const asUtf8 = () => raw.toString("utf8").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()

  const isTextLike = [".txt", ".md", ".json", ".csv"].includes(extension)
  const isSupportedMime = [
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "application/pdf",
  ].includes(mimeType || "")

  if (isTextLike || isSupportedMime) {
    if (extension === ".json" || mimeType === "application/json") {
      const source = asUtf8()
      try {
        return JSON.stringify(JSON.parse(source), null, 2)
      } catch {
        return source
      }
    }

    if (extension === ".pdf" || mimeType === "application/pdf") {
      const parser = new PDFParse({ data: raw })

      try {
        const parsed = await parser.getText()
        const text = (parsed.text || "").replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
        if (!text) {
          throw new Error("PDF parsed but no text content was extracted.")
        }

        return text
      } finally {
        await parser.destroy()
      }
    }

    return asUtf8()
  }

  throw new Error("Unsupported file type for extraction.")
}