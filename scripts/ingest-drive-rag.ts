import { createHash, randomUUID } from "node:crypto"
import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile, appendFile, access, rm } from "node:fs/promises"
import { basename, extname, join } from "node:path"
import { config as loadDotenv } from "dotenv"

import pool from "@/lib/db"
import { chunkText } from "@/lib/chunk"
import { embedBatch, EXPECTED_EMBEDDING_DIMENSION } from "@/lib/embed"
import { extractTextFromFile } from "@/lib/extract-text"
import { getRuntimeStoragePaths } from "@/lib/tools/types"

type ManifestRow = {
  path?: unknown
  name?: unknown
  remote?: unknown
  include?: unknown
  includeForRag?: unknown
  sizeBytes?: unknown
  mimeType?: unknown
  modifiedTime?: unknown
  recommendedExport?: unknown
  sourceFileId?: unknown
}

type DriveCandidate = {
  path: string
  name: string
  remote: string
  include: boolean
  sizeBytes: number
  mimeType: string | null
  modifiedTime: string | null
  recommendedExport: string | null
  sourceFileId: string | null
}

type IngestFailure = {
  path: string
  stage: "download" | "extract" | "embed" | "db"
  reason: string
}

const DEFAULT_LIMIT = 10
const DEFAULT_MAX_FILE_MB = 50
const DEFAULT_REMOTE = ""
const DIRECT_EXTRACTABLE_EXTENSIONS = new Set([".txt", ".md", ".markdown", ".json", ".csv", ".tsv", ".pdf"])

const MANIFEST_CANDIDATES = [
  "/var/lib/aeonops/drive/manifests/google-drive-rag-manifest.jsonl",
  "/var/lib/aeonops/drive/manifests/google-native-docs-hunt.jsonl",
  "/home/aeon-rag/storage/manifests/google-drive-rag-manifest.jsonl",
]

function parseLimit(argv: string[]): number {
  const explicit = argv.find((arg) => arg.startsWith("--limit="))
  const next = argv.findIndex((arg) => arg === "--limit")

  let value: string | undefined
  if (explicit) {
    value = explicit.split("=")[1]
  } else if (next >= 0 && argv[next + 1]) {
    value = argv[next + 1]
  }

  const parsed = value ? Number.parseInt(value, 10) : DEFAULT_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT
  }

  return Math.min(parsed, 200)
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

function toStringOrNull(value: unknown): string | null {
  if (typeof value !== "string") {
    return null
  }

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeDrivePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\/+/, "")
}

function sanitizeFileName(input: string): string {
  return input.replace(/[^a-zA-Z0-9._-]/g, "_")
}

function parseManifestLine(line: string): DriveCandidate | null {
  let parsed: ManifestRow

  try {
    parsed = JSON.parse(line) as ManifestRow
  } catch {
    return null
  }

  const pathValue = toStringOrNull(parsed.path)
  if (!pathValue) {
    return null
  }

  const path = normalizeDrivePath(pathValue)
  const include = Boolean(parsed.include ?? parsed.includeForRag)

  const remote = toStringOrNull(parsed.remote) || process.env.GOOGLE_DRIVE_REMOTE?.trim() || DEFAULT_REMOTE
  const fallbackName = basename(path)

  return {
    path,
    name: toStringOrNull(parsed.name) || fallbackName,
    remote,
    include,
    sizeBytes: Math.max(0, Math.trunc(toNumber(parsed.sizeBytes))),
    mimeType: toStringOrNull(parsed.mimeType),
    modifiedTime: toStringOrNull(parsed.modifiedTime),
    recommendedExport: toStringOrNull(parsed.recommendedExport),
    sourceFileId: toStringOrNull(parsed.sourceFileId),
  }
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stderr = ""
    child.stderr.setEncoding("utf8")
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
    })

    child.on("error", (error) => reject(error))
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}: ${stderr.trim()}`))
    })
  })
}

function guessMimeByExtension(fileName: string, fallbackMime: string | null): string | undefined {
  const ext = extname(fileName).toLowerCase()
  if (ext === ".txt" || ext === ".md") return "text/plain"
  if (ext === ".csv") return "text/csv"
  if (ext === ".json") return "application/json"
  if (ext === ".pdf") return "application/pdf"
  return fallbackMime || undefined
}

function chooseDownloadExtension(candidate: DriveCandidate): string {
  const nativeExt = extname(candidate.name).toLowerCase()
  if (nativeExt) {
    return nativeExt
  }

  const recommended = (candidate.recommendedExport || "").toLowerCase()
  if (recommended.includes("csv")) return ".csv"
  if (recommended.includes("txt")) return ".txt"
  if (recommended.includes("docx")) return ".docx"
  if (recommended.includes("pdf")) return ".pdf"

  if ((candidate.mimeType || "").includes("spreadsheet")) return ".csv"
  return ".txt"
}

function chooseDriveExportFormats(candidate: DriveCandidate, extension: string): string {
  if (extension === ".csv") {
    return "csv"
  }

  if (extension === ".txt") {
    return "txt"
  }

  if (extension === ".docx") {
    return "docx,txt"
  }

  if (extension === ".pdf") {
    return "pdf,txt"
  }

  return "txt,csv,docx,pdf"
}

function buildRemoteSource(remote: string, path: string): string {
  const trimmedRemote = remote.trim()
  const withSuffix = trimmedRemote.endsWith(":") ? trimmedRemote : `${trimmedRemote}:`
  return `${withSuffix}${path}`
}

function hashText(content: string): string {
  return createHash("sha256").update(content).digest("hex")
}

async function loadManifestCandidates(): Promise<DriveCandidate[]> {
  const seen = new Set<string>()
  const candidates: DriveCandidate[] = []

  for (const filePath of MANIFEST_CANDIDATES) {
    try {
      await access(filePath)
    } catch {
      continue
    }

    const raw = await readFile(filePath, "utf8")
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)

    for (const line of lines) {
      const parsed = parseManifestLine(line)
      if (!parsed || !parsed.include) {
        continue
      }

      if (seen.has(parsed.path)) {
        continue
      }

      seen.add(parsed.path)
      candidates.push(parsed)
    }
  }

  return candidates
}

function chooseCandidatesForRun(candidates: DriveCandidate[], limit: number): DriveCandidate[] {
  const preferred: DriveCandidate[] = []
  const fallback: DriveCandidate[] = []

  for (const candidate of candidates) {
    const extension = extname(candidate.name).toLowerCase()
    const hasDirectSupport = DIRECT_EXTRACTABLE_EXTENSIONS.has(extension)
    const needsExport = !extension

    if (hasDirectSupport || needsExport) {
      preferred.push(candidate)
    } else {
      fallback.push(candidate)
    }
  }

  return [...preferred, ...fallback].slice(0, limit)
}

async function ensureRuntimeDirs() {
  const runtime = getRuntimeStoragePaths()
  await mkdir(runtime.driveImports, { recursive: true })
  await mkdir(runtime.driveExtracted, { recursive: true })
  await mkdir(runtime.driveFailed, { recursive: true })
  return runtime
}

async function insertJob(remote: string, limit: number): Promise<string> {
  const result = await pool.query<{ id: string }>(
    `
    INSERT INTO drive_import_jobs (source, remote, limit_requested, status, started_at)
    VALUES ('google_drive', $1, $2, 'running', NOW())
    RETURNING id
    `,
    [remote, limit],
  )

  return result.rows[0].id
}

async function completeJob(params: {
  id: string
  status: "success" | "partial" | "error"
  scannedCount: number
  attemptedCount: number
  importedCount: number
  skippedCount: number
  failedCount: number
  errorCount: number
  message: string
}) {
  await pool.query(
    `
    UPDATE drive_import_jobs
    SET
      status = $2,
      scanned_count = $3,
      attempted_count = $4,
      imported_count = $5,
      skipped_count = $6,
      failed_count = $7,
      error_count = $8,
      message = $9,
      finished_at = NOW()
    WHERE id = $1
    `,
    [
      params.id,
      params.status,
      params.scannedCount,
      params.attemptedCount,
      params.importedCount,
      params.skippedCount,
      params.failedCount,
      params.errorCount,
      params.message,
    ],
  )
}

async function documentAlreadyIndexed(path: string, contentHash: string): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `
    SELECT id
    FROM documents
    WHERE drive_path = $1 AND content_hash = $2 AND status = 'indexed'
    LIMIT 1
    `,
    [path, contentHash],
  )

  return Number(result.rowCount || 0) > 0
}

async function insertDocumentAndChunks(input: {
  candidate: DriveCandidate
  storedPath: string
  mimeType: string
  sizeBytes: number
  contentHash: string
  chunks: string[]
  embeddings: number[][]
}) {
  const client = await pool.connect()

  try {
    await client.query("BEGIN")

    const doc = await client.query<{ id: string }>(
      `
      INSERT INTO documents (
        name,
        original_name,
        type,
        mime_type,
        size_bytes,
        stored_path,
        status,
        source,
        source_file_id,
        drive_path,
        content_hash,
        imported_at,
        last_ingested_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'indexed', 'google_drive', $7, $8, $9, NOW(), NOW(), NOW())
      RETURNING id
      `,
      [
        input.candidate.name,
        input.candidate.name,
        input.mimeType,
        input.mimeType,
        input.sizeBytes,
        input.storedPath,
        input.candidate.sourceFileId,
        input.candidate.path,
        input.contentHash,
      ],
    )

    const documentId = doc.rows[0].id

    for (let i = 0; i < input.chunks.length; i += 1) {
      const vector = input.embeddings[i]
      if (!vector || vector.length !== EXPECTED_EMBEDDING_DIMENSION) {
        throw new Error(
          `Embedding dimension mismatch at chunk ${i}: got ${vector?.length ?? 0}, expected ${EXPECTED_EMBEDDING_DIMENSION}.`,
        )
      }

      const literal = `[${vector.join(",")}]`

      await client.query(
        `
        INSERT INTO chunks (document_id, content, chunk_index, embedding)
        VALUES ($1, $2, $3, $4::vector)
        `,
        [documentId, input.chunks[i], i, literal],
      )

      await client.query(
        `
        INSERT INTO document_chunks (document_id, chunk_index, content, embedding)
        VALUES ($1, $2, $3, $4::vector)
        `,
        [documentId, i, input.chunks[i], literal],
      )
    }

    await client.query("COMMIT")
    return documentId
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  loadDotenv({ path: ".env.local" })

  const limit = parseLimit(process.argv.slice(2))
  const runtime = await ensureRuntimeDirs()

  const allCandidates = await loadManifestCandidates()
  const selected = chooseCandidatesForRun(allCandidates, limit)

  const envRemote = process.env.GOOGLE_DRIVE_REMOTE?.trim() || DEFAULT_REMOTE
  const maxFileMb = Number.parseInt(process.env.BULK_IMPORT_MAX_FILE_MB || String(DEFAULT_MAX_FILE_MB), 10)
  const maxFileBytes = (Number.isFinite(maxFileMb) && maxFileMb > 0 ? maxFileMb : DEFAULT_MAX_FILE_MB) * 1024 * 1024
  const remote = selected[0]?.remote || envRemote

  if (!remote) {
    throw new Error("Missing required env var: GOOGLE_DRIVE_REMOTE")
  }

  const jobId = await insertJob(remote, limit)

  let attemptedCount = 0
  let importedCount = 0
  let skippedCount = 0
  let failedCount = 0
  let errorCount = 0

  const failures: IngestFailure[] = []

  for (const candidate of selected) {
    if (candidate.sizeBytes > 0 && candidate.sizeBytes > maxFileBytes) {
      skippedCount += 1
      continue
    }

    attemptedCount += 1

    const fileId = randomUUID()
    const extension = chooseDownloadExtension(candidate)
    const baseName = sanitizeFileName(candidate.name.replace(extname(candidate.name), "")) || "drive_file"
    const storedFile = `${fileId}-${baseName}${extension}`
    const importPath = join(runtime.driveImports, storedFile)

    try {
      const source = `${remote}:${candidate.path}`
      const exportFormats = chooseDriveExportFormats(candidate, extension)
      const sourcePath = buildRemoteSource(remote, candidate.path)
      const isGoogleNative = !extname(candidate.name) || (candidate.mimeType || "").includes("application/vnd.google-apps")

      const args = ["copyto", sourcePath, importPath]
      if (isGoogleNative) {
        args.push("--drive-export-formats", exportFormats)
      }

      await runCommand("rclone", args)

      const extracted = await extractTextFromFile(importPath, guessMimeByExtension(importPath, candidate.mimeType))
      const chunks = chunkText(extracted)

      if (chunks.length === 0) {
        throw new Error("No chunks produced from extracted text.")
      }

      const embeddings = await embedBatch(chunks)
      const contentHash = hashText(extracted)

      const duplicate = await documentAlreadyIndexed(candidate.path, contentHash)
      if (duplicate) {
        skippedCount += 1
        continue
      }

      const storedPath = `${runtime.driveImports}/${storedFile}`
      const mimeType = guessMimeByExtension(importPath, candidate.mimeType) || "text/plain"

      await insertDocumentAndChunks({
        candidate,
        storedPath,
        mimeType,
        sizeBytes: candidate.sizeBytes,
        contentHash,
        chunks,
        embeddings,
      })

      importedCount += 1

      const extractedMetaPath = join(runtime.driveExtracted, `${fileId}.json`)
      await writeFile(
        extractedMetaPath,
        JSON.stringify(
          {
            path: candidate.path,
            storedPath,
            chunkCount: chunks.length,
            contentHash,
            importedAt: new Date().toISOString(),
          },
          null,
          2,
        ) + "\n",
        "utf8",
      )

      await rm(importPath, { force: true })
    } catch (error) {
      failedCount += 1
      errorCount += 1
      const reason = error instanceof Error ? error.message : "Unknown ingestion failure"
      failures.push({
        path: candidate.path,
        stage: reason.includes("rclone")
          ? "download"
          : reason.includes("insert") || reason.includes("documents") || reason.includes("chunks")
            ? "db"
            : reason.includes("extract") || reason.includes("Unsupported")
              ? "extract"
              : "embed",
        reason,
      })
    }
  }

  const status: "success" | "partial" | "error" =
    failedCount === 0 ? "success" : importedCount > 0 || skippedCount > 0 ? "partial" : "error"

  const message = `scanned=${selected.length} attempted=${attemptedCount} imported=${importedCount} skipped=${skippedCount} failed=${failedCount}`

  await completeJob({
    id: jobId,
    status,
    scannedCount: selected.length,
    attemptedCount,
    importedCount,
    skippedCount,
    failedCount,
    errorCount,
    message,
  })

  if (failures.length > 0) {
    const failurePath = join(runtime.driveFailed, `drive-import-failures-${jobId}.jsonl`)
    await appendFile(failurePath, `${failures.map((entry) => JSON.stringify(entry)).join("\n")}\n`, "utf8")
  }

  console.log(`Job: ${jobId}`)
  console.log(`Status: ${status}`)
  console.log(`Scanned: ${selected.length}`)
  console.log(`Attempted: ${attemptedCount}`)
  console.log(`Imported: ${importedCount}`)
  console.log(`Skipped: ${skippedCount}`)
  console.log(`Failed: ${failedCount}`)
}

main().catch(async (error) => {
  const safe = error instanceof Error ? error.message : "Unknown drive ingest failure"
  console.error(safe)
  process.exit(1)
})
