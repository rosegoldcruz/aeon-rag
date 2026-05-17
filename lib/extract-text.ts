import { access, mkdtemp, readFile, rm } from "node:fs/promises"
import { extname } from "node:path"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { spawn } from "node:child_process"

const MAX_TEXT_BYTES = 20 * 1024 * 1024

async function runPdftotext(filePath: string): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), "aeon-pdftotext-"))
  const outputPath = join(tempDir, "out.txt")

  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("pdftotext", ["-layout", filePath, outputPath], {
        stdio: ["ignore", "pipe", "pipe"],
      })

      let stderr = ""
      child.stderr.setEncoding("utf8")
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk
      })

      child.on("error", (error) => {
        const code = (error as NodeJS.ErrnoException).code || ""
        if (code === "ENOENT") {
          reject(new Error("Missing PDF extractor dependency: pdftotext (poppler-utils)"))
          return
        }

        reject(error)
      })

      child.on("close", (code) => {
        if (code !== 0) {
          reject(new Error(`pdftotext failed with exit code ${code}: ${stderr.trim()}`))
          return
        }

        resolve()
      })
    })

    const extracted = await readFile(outputPath, "utf8")
    const normalized = extracted.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    if (!normalized) {
      throw new Error("PDF parsed but no text content was extracted.")
    }

    return normalized
  } finally {
    await rm(tempDir, { recursive: true, force: true })
  }
}

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
      return runPdftotext(filePath)
    }

    return asUtf8()
  }

  throw new Error("Unsupported file type for extraction.")
}