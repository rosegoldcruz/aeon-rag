import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import { randomUUID } from "node:crypto"

import { ingestStoredFile } from "@/lib/ingest"

const RUNTIME_UPLOAD_DIR = "/var/lib/aeonops/uploads"

type Mode = "txt" | "pdf"

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = (args[0] || "txt") as Mode
  const fileArg = args[1]
  return { mode, fileArg }
}

async function runTxtTest() {
  await mkdir(RUNTIME_UPLOAD_DIR, { recursive: true })

  const name = `upload-smoke-${Date.now()}.txt`
  const path = join(RUNTIME_UPLOAD_DIR, `${randomUUID()}-${name}`)
  const content = [
    "AEON upload smoke test.",
    "This file validates manual upload ingestion path using real extract/chunk/embed/insert logic.",
    "Line 3 adds extra content to ensure chunking threshold is met.",
  ].join("\n")

  await writeFile(path, content, "utf8")

  const result = await ingestStoredFile({
    storedPath: path,
    name,
    type: "text/plain",
    sizeBytes: Buffer.byteLength(content, "utf8"),
  })

  await rm(path, { force: true })

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "txt",
        documentId: result.documentId,
        chunkCount: result.chunkCount,
      },
      null,
      2,
    ),
  )
}

async function runPdfTest(inputPath: string) {
  await mkdir(RUNTIME_UPLOAD_DIR, { recursive: true })

  const raw = await readFile(inputPath)
  const ext = extname(inputPath).toLowerCase() || ".pdf"
  const name = basename(inputPath)
  const path = join(RUNTIME_UPLOAD_DIR, `${randomUUID()}-${name}`)
  await writeFile(path, raw)

  try {
    const result = await ingestStoredFile({
      storedPath: path,
      name,
      type: "application/pdf",
      sizeBytes: raw.byteLength,
    })

    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: "pdf",
          extension: ext,
          sourcePath: inputPath,
          documentId: result.documentId,
          chunkCount: result.chunkCount,
        },
        null,
        2,
      ),
    )
  } finally {
    await rm(path, { force: true })
  }
}

async function main() {
  const { mode, fileArg } = parseArgs()

  if (mode === "txt") {
    await runTxtTest()
    return
  }

  if (mode === "pdf") {
    if (!fileArg) {
      throw new Error("Usage: tsx scripts/test-upload-ingest.ts pdf /absolute/path/to/file.pdf")
    }

    await runPdfTest(fileArg)
    return
  }

  throw new Error("Unknown mode. Use 'txt' or 'pdf'.")
}

main().catch((error) => {
  const safeMessage = error instanceof Error ? error.message : "Unknown upload-ingest smoke test failure"
  console.error(safeMessage)
  process.exit(1)
})
