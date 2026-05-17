import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, extname, join } from "node:path"

type RcloneEntry = {
  Path: string
  Name: string
  Size: number
  MimeType?: string
  ModTime?: string
  IsDir: boolean
  ID?: string
}

type ManifestReason =
  | "supported_pdf"
  | "supported_text"
  | "supported_document"
  | "supported_code"
  | "supported_spreadsheet"
  | "excluded_image"
  | "excluded_video"
  | "excluded_audio"
  | "excluded_archive"
  | "excluded_binary"
  | "excluded_system"
  | "excluded_too_large"
  | "unsupported_extension"

type ManifestRecord = {
  source: "google_drive"
  remote: string
  path: string
  name: string
  extension: string
  sizeBytes: number
  modifiedTime: string | null
  include: boolean
  status: "included" | "skipped"
  reason: ManifestReason
}

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".heic",
  ".svg",
  ".bmp",
  ".tiff",
])

const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".mov",
  ".avi",
  ".mkv",
  ".webm",
  ".m4v",
  ".wmv",
])

const AUDIO_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".flac", ".ogg"])

const ARCHIVE_EXTENSIONS = new Set([".zip", ".rar", ".7z", ".tar", ".gz", ".tgz"])

const BINARY_EXTENSIONS = new Set([".exe", ".msi", ".dmg", ".pkg", ".appimage"])

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".rtf",
  ".json",
  ".jsonl",
  ".html",
  ".htm",
  ".sql",
  ".xml",
  ".yaml",
  ".yml",
  ".env.example",
])

const DOCUMENT_EXTENSIONS = new Set([".docx", ".doc"])
const SPREADSHEET_EXTENSIONS = new Set([".csv", ".tsv"])
const CODE_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx", ".py", ".sh", ".css", ".scss"])

const EXCLUDED_FILE_NAMES = new Set([".ds_store", "thumbs.db", "desktop.ini"])
const EXCLUDED_PATH_SEGMENTS = new Set(["__macosx", "node_modules", ".git", ".next", ".cache"])

function parseEnvLine(line: string): [string, string] | null {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
    return null
  }

  const [key, ...rest] = trimmed.split("=")
  const value = rest.join("=").replace(/^['"]|['"]$/g, "")
  return [key, value]
}

async function loadEnvLocalIfNeeded() {
  const envPath = join(process.cwd(), ".env.local")

  try {
    const raw = await readFile(envPath, "utf8")
    for (const line of raw.split(/\r?\n/)) {
      const parsed = parseEnvLine(line)
      if (!parsed) {
        continue
      }
      const [key, value] = parsed
      if (!(key in process.env)) {
        process.env[key] = value
      }
    }
  } catch {
    // Missing .env.local is acceptable; required vars are validated later.
  }
}

function getExtension(name: string): string {
  const lower = name.toLowerCase()
  if (lower.endsWith(".env.example")) {
    return ".env.example"
  }

  return extname(lower)
}

function hasExcludedPathSegment(pathValue: string): boolean {
  const normalized = pathValue.replace(/\\/g, "/")
  const segments = normalized.split("/").map((part) => part.toLowerCase())
  return segments.some((segment) => EXCLUDED_PATH_SEGMENTS.has(segment))
}

function reasonFromMimeTypeForNoExtension(mimeType?: string): ManifestReason | null {
  const lower = (mimeType ?? "").toLowerCase()
  if (!lower) {
    return null
  }

  if (lower === "application/vnd.google-apps.document") {
    return "supported_document"
  }

  if (lower === "application/vnd.google-apps.spreadsheet") {
    return "supported_spreadsheet"
  }

  return null
}

function classifyByExtension(extension: string): ManifestReason {
  if (extension === ".pdf") {
    return "supported_pdf"
  }
  if (TEXT_EXTENSIONS.has(extension)) {
    return "supported_text"
  }
  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return "supported_document"
  }
  if (SPREADSHEET_EXTENSIONS.has(extension)) {
    return "supported_spreadsheet"
  }
  if (CODE_EXTENSIONS.has(extension)) {
    return "supported_code"
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "excluded_image"
  }
  if (VIDEO_EXTENSIONS.has(extension)) {
    return "excluded_video"
  }
  if (AUDIO_EXTENSIONS.has(extension)) {
    return "excluded_audio"
  }
  if (ARCHIVE_EXTENSIONS.has(extension)) {
    return "excluded_archive"
  }
  if (BINARY_EXTENSIONS.has(extension)) {
    return "excluded_binary"
  }

  return "unsupported_extension"
}

function isIncludedReason(reason: ManifestReason): boolean {
  return (
    reason === "supported_pdf" ||
    reason === "supported_text" ||
    reason === "supported_document" ||
    reason === "supported_code" ||
    reason === "supported_spreadsheet"
  )
}

function topExtensions(records: ManifestRecord[], status: "included" | "skipped") {
  const counts = new Map<string, number>()

  for (const record of records) {
    if (record.status !== status) {
      continue
    }

    const key = record.extension || "(none)"
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([extension, count]) => ({ extension, count }))
}

async function runRcloneLsjson(remote: string): Promise<RcloneEntry[]> {
  const args = ["lsjson", remote, "--recursive", "--files-only"]

  return new Promise((resolve, reject) => {
    const child = spawn("rclone", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    let stdout = ""
    let stderr = ""

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")

    child.stdout.on("data", (chunk: string) => {
      stdout += chunk
    })

    child.stderr.on("data", (chunk: string) => {
      stderr += chunk
    })

    child.on("error", (error) => {
      reject(error)
    })

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`rclone lsjson failed with exit code ${code}: ${stderr.trim()}`))
        return
      }

      try {
        const parsed = JSON.parse(stdout) as RcloneEntry[]
        resolve(parsed)
      } catch {
        reject(new Error("Failed to parse rclone lsjson output as JSON."))
      }
    })
  })
}

async function main() {
  await loadEnvLocalIfNeeded()

  const remote = process.env.GOOGLE_DRIVE_REMOTE
  if (!remote) {
    throw new Error("Missing required env var: GOOGLE_DRIVE_REMOTE")
  }

  const maxFileMb = Number.parseInt(process.env.BULK_IMPORT_MAX_FILE_MB ?? "50", 10)
  const maxFileBytes = (Number.isFinite(maxFileMb) && maxFileMb > 0 ? maxFileMb : 50) * 1024 * 1024

  const entries = await runRcloneLsjson(remote)
  const records: ManifestRecord[] = []

  for (const entry of entries) {
    const recordPath = entry.Path.replace(/\\/g, "/")
    const name = entry.Name || recordPath.split("/").at(-1) || ""
    const extension = getExtension(name)
    const fileNameLower = name.toLowerCase()
    const sizeBytes = Number.isFinite(entry.Size) ? entry.Size : 0

    let reason: ManifestReason

    if (EXCLUDED_FILE_NAMES.has(fileNameLower) || hasExcludedPathSegment(recordPath)) {
      reason = "excluded_system"
    } else {
      const mimeReason = !extension ? reasonFromMimeTypeForNoExtension(entry.MimeType) : null
      reason = mimeReason ?? classifyByExtension(extension)
    }

    let include = isIncludedReason(reason)

    if (include && sizeBytes >= 0 && sizeBytes > maxFileBytes) {
      include = false
      reason = "excluded_too_large"
    }

    records.push({
      source: "google_drive",
      remote,
      path: recordPath,
      name,
      extension,
      sizeBytes,
      modifiedTime: entry.ModTime ?? null,
      include,
      status: include ? "included" : "skipped",
      reason,
    })
  }

  const manifestsDir = join(process.cwd(), "storage", "manifests")
  await mkdir(manifestsDir, { recursive: true })

  const jsonlPath = join(manifestsDir, "google-drive-rag-manifest.jsonl")
  const tsvPath = join(manifestsDir, "google-drive-rag-manifest.tsv")
  const summaryPath = join(manifestsDir, "google-drive-rag-manifest-summary.json")

  const jsonl = records.map((record) => JSON.stringify(record)).join("\n") + "\n"
  await writeFile(jsonlPath, jsonl, "utf8")

  const tsvHeader = [
    "source",
    "remote",
    "path",
    "name",
    "extension",
    "sizeBytes",
    "modifiedTime",
    "include",
    "status",
    "reason",
  ]

  const tsvRows = records.map((record) => {
    const values = [
      record.source,
      record.remote,
      record.path,
      record.name,
      record.extension,
      String(record.sizeBytes),
      record.modifiedTime ?? "",
      String(record.include),
      record.status,
      record.reason,
    ]

    return values.map((value) => value.replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")
  })

  await writeFile(tsvPath, [tsvHeader.join("\t"), ...tsvRows].join("\n") + "\n", "utf8")

  const includedRecords = records.filter((record) => record.status === "included")
  const skippedRecords = records.filter((record) => record.status === "skipped")

  const summary = {
    totalScanned: records.length,
    included: includedRecords.length,
    skipped: skippedRecords.length,
    includedBytes: includedRecords.reduce((sum, record) => sum + Math.max(0, record.sizeBytes), 0),
    skippedBytes: skippedRecords.reduce((sum, record) => sum + Math.max(0, record.sizeBytes), 0),
    topIncludedExtensions: topExtensions(records, "included"),
    topSkippedExtensions: topExtensions(records, "skipped"),
    largestSkippedFiles: skippedRecords
      .slice()
      .sort((a, b) => b.sizeBytes - a.sizeBytes)
      .slice(0, 20)
      .map((record) => ({
        path: record.path,
        name: record.name,
        extension: record.extension || "(none)",
        sizeBytes: record.sizeBytes,
        reason: record.reason,
      })),
  }

  await writeFile(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8")

  console.log(`Remote used: ${remote}`)
  console.log(`Manifest written: ${jsonlPath}`)
  console.log(`Manifest written: ${tsvPath}`)
  console.log(`Summary written: ${summaryPath}`)
  console.log(`Scanned: ${summary.totalScanned} | Included: ${summary.included} | Skipped: ${summary.skipped}`)
}

main().catch((error) => {
  const safeMessage = error instanceof Error ? error.message : "Unknown manifest generation failure"
  console.error(safeMessage)
  process.exit(1)
})