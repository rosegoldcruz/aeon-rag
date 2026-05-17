import { spawn } from "node:child_process"
import { mkdir, readFile, writeFile, appendFile, access } from "node:fs/promises"
import { basename, dirname, extname, join } from "node:path"

type RcloneEntry = {
  Path?: string
  Name?: string
  Size?: number
  MimeType?: string
  mimeType?: string
  ModTime?: string
  IsDir?: boolean
  Metadata?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

type GoogleNativeType =
  | "google_doc"
  | "google_sheet"
  | "google_slide"
  | "google_drawing"
  | "google_form"
  | "google_jamboard"
  | "google_unknown"

type HuntClassification =
  | GoogleNativeType
  | "normal_supported"
  | "normal_unsupported"
  | "suspicious_extensionless"

type HuntRecord = {
  source: "google_drive"
  remote: string
  path: string
  name: string
  extension: string
  sizeBytes: number
  mimeType: string | null
  modifiedTime: string | null
  isGoogleNative: boolean
  googleNativeType: GoogleNativeType | null
  recommendedExport: string
  includeForRag: boolean
  reason: string
  classification: HuntClassification
  alreadyCoveredByManifest: boolean
  likelyMissingFromManifest: boolean
}

type ExistingManifestRecord = {
  path?: unknown
  include?: unknown
}

const SUPPORTED_EXTENSIONS = new Set([
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".jsonl",
  ".html",
  ".htm",
  ".sql",
  ".xml",
  ".yaml",
  ".yml",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".sh",
  ".css",
  ".scss",
  ".pdf",
  ".docx",
  ".doc",
  ".rtf",
])

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
    // Missing .env.local is tolerated until required var checks.
  }
}

async function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
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
        reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}: ${stderr.trim()}`))
        return
      }

      resolve(stdout)
    })
  })
}

async function runRcloneLsjson(remote: string): Promise<RcloneEntry[]> {
  let output = ""

  try {
    output = await runCommand("rclone", ["lsjson", remote, "--recursive", "--files-only", "--metadata"])
  } catch (error) {
    const safe = error instanceof Error ? error.message : ""
    if (!safe.toLowerCase().includes("unknown flag") || !safe.includes("--metadata")) {
      throw error
    }

    output = await runCommand("rclone", ["lsjson", remote, "--recursive", "--files-only"])
  }

  try {
    const parsed = JSON.parse(output) as RcloneEntry[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    throw new Error("Failed to parse rclone lsjson output as JSON.")
  }
}

async function runRcloneLsf(remote: string): Promise<string[]> {
  const output = await runCommand("rclone", ["lsf", remote, "--recursive", "--files-only", "--format", "pstm"])
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function normalizePath(input: string): string {
  return input.replace(/\\/g, "/")
}

function extensionOf(name: string): string {
  return extname(name.toLowerCase())
}

function toGoogleNativeType(mimeType: string): GoogleNativeType {
  if (mimeType.includes("application/vnd.google-apps.document")) {
    return "google_doc"
  }

  if (mimeType.includes("application/vnd.google-apps.spreadsheet")) {
    return "google_sheet"
  }

  if (mimeType.includes("application/vnd.google-apps.presentation")) {
    return "google_slide"
  }

  if (mimeType.includes("application/vnd.google-apps.drawing")) {
    return "google_drawing"
  }

  if (mimeType.includes("application/vnd.google-apps.form")) {
    return "google_form"
  }

  if (mimeType.includes("application/vnd.google-apps.jam")) {
    return "google_jamboard"
  }

  return "google_unknown"
}

function recommendedExportForGoogleType(type: GoogleNativeType): string {
  switch (type) {
    case "google_doc":
      return "docx"
    case "google_sheet":
      return "xlsx,csv"
    case "google_slide":
      return "pptx,pdf"
    case "google_drawing":
      return "pdf"
    case "google_form":
      return "metadata_only"
    case "google_jamboard":
      return "pdf"
    default:
      return "inspect"
  }
}

function includeForRagGoogleType(type: GoogleNativeType): boolean {
  return type === "google_doc" || type === "google_sheet" || type === "google_slide" || type === "google_drawing"
}

function asLowerString(value: unknown): string {
  return typeof value === "string" ? value.toLowerCase() : ""
}

function getMimeType(entry: RcloneEntry): string {
  const direct = (entry.MimeType || entry.mimeType || "").trim().toLowerCase()
  if (direct) {
    return direct
  }

  const metadata = entry.Metadata || entry.metadata
  if (!metadata || typeof metadata !== "object") {
    return ""
  }

  const metadataMime = asLowerString((metadata as Record<string, unknown>).mimeType || (metadata as Record<string, unknown>).MimeType)
  if (metadataMime) {
    return metadataMime
  }

  const contentType = asLowerString((metadata as Record<string, unknown>)["content-type"])
  return contentType
}

function metadataLooksGoogleNative(entry: RcloneEntry): boolean {
  const metadata = entry.Metadata || entry.metadata
  if (!metadata || typeof metadata !== "object") {
    return false
  }

  return JSON.stringify(metadata).toLowerCase().includes("google-apps")
}

function classifyRecord(input: {
  remote: string
  path: string
  name: string
  extension: string
  sizeBytes: number
  mimeType: string
  modifiedTime: string | null
  metadataHasGoogleApps: boolean
  covered: boolean
}): HuntRecord {
  const hasExtension = input.extension.length > 0
  const googleMime = input.mimeType.includes("application/vnd.google-apps")
  const sizeLooksGoogle = input.sizeBytes <= 0

  const isGoogleNative =
    googleMime ||
    input.metadataHasGoogleApps ||
    (!hasExtension && (googleMime || input.mimeType.includes("google-apps"))) ||
    (sizeLooksGoogle && googleMime)

  if (isGoogleNative) {
    const googleNativeType = toGoogleNativeType(input.mimeType)
    const recommendedExport = recommendedExportForGoogleType(googleNativeType)
    const includeForRag = includeForRagGoogleType(googleNativeType)

    const reasons: string[] = []
    if (googleMime) reasons.push("mimeType contains application/vnd.google-apps")
    if (input.metadataHasGoogleApps) reasons.push("metadata contains google-apps")
    if (!hasExtension) reasons.push("path has no extension")
    if (sizeLooksGoogle) reasons.push("size is zero-or-less")

    return {
      source: "google_drive",
      remote: input.remote,
      path: input.path,
      name: input.name,
      extension: input.extension,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType || null,
      modifiedTime: input.modifiedTime,
      isGoogleNative: true,
      googleNativeType,
      recommendedExport,
      includeForRag,
      reason: reasons.join("; "),
      classification: googleNativeType,
      alreadyCoveredByManifest: input.covered,
      likelyMissingFromManifest: !input.covered,
    }
  }

  if (!hasExtension) {
    return {
      source: "google_drive",
      remote: input.remote,
      path: input.path,
      name: input.name,
      extension: input.extension,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType || null,
      modifiedTime: input.modifiedTime,
      isGoogleNative: false,
      googleNativeType: null,
      recommendedExport: "inspect",
      includeForRag: false,
      reason: "No extension and no clear google-apps mime metadata",
      classification: "suspicious_extensionless",
      alreadyCoveredByManifest: input.covered,
      likelyMissingFromManifest: false,
    }
  }

  if (SUPPORTED_EXTENSIONS.has(input.extension)) {
    return {
      source: "google_drive",
      remote: input.remote,
      path: input.path,
      name: input.name,
      extension: input.extension,
      sizeBytes: input.sizeBytes,
      mimeType: input.mimeType || null,
      modifiedTime: input.modifiedTime,
      isGoogleNative: false,
      googleNativeType: null,
      recommendedExport: "n/a",
      includeForRag: true,
      reason: "Supported extension",
      classification: "normal_supported",
      alreadyCoveredByManifest: input.covered,
      likelyMissingFromManifest: false,
    }
  }

  return {
    source: "google_drive",
    remote: input.remote,
    path: input.path,
    name: input.name,
    extension: input.extension,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType || null,
    modifiedTime: input.modifiedTime,
    isGoogleNative: false,
    googleNativeType: null,
    recommendedExport: "n/a",
    includeForRag: false,
    reason: "Unsupported extension",
    classification: "normal_unsupported",
    alreadyCoveredByManifest: input.covered,
    likelyMissingFromManifest: false,
  }
}

async function readExistingManifestPaths(paths: string[]): Promise<Set<string>> {
  const covered = new Set<string>()

  for (const path of paths) {
    try {
      await access(path)
    } catch {
      continue
    }

    const raw = await readFile(path, "utf8")
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)

    for (const line of lines) {
      try {
        const parsed = JSON.parse(line) as ExistingManifestRecord
        if (typeof parsed.path === "string" && parsed.path.trim()) {
          covered.add(normalizePath(parsed.path))
        }
      } catch {
        continue
      }
    }
  }

  return covered
}

function toTsv(record: HuntRecord): string {
  const values = [
    record.source,
    record.remote,
    record.path,
    record.name,
    record.extension,
    String(record.sizeBytes),
    record.mimeType ?? "",
    record.modifiedTime ?? "",
    String(record.isGoogleNative),
    record.googleNativeType ?? "",
    record.recommendedExport,
    String(record.includeForRag),
    record.reason,
    record.classification,
    String(record.alreadyCoveredByManifest),
    String(record.likelyMissingFromManifest),
  ]

  return values.map((value) => value.replace(/\t/g, " ").replace(/\r?\n/g, " ")).join("\t")
}

function folderKey(pathValue: string): string {
  const normalized = normalizePath(pathValue)
  const dir = dirname(normalized)
  if (!dir || dir === ".") {
    return "(root)"
  }

  const segments = dir.split("/").filter(Boolean)
  if (segments.length <= 2) {
    return dir
  }

  return `${segments[0]}/${segments[1]}`
}

async function upsertRuntimeManifestForMissingGoogleNative(input: {
  records: HuntRecord[]
  manifestPath: string
  remote: string
}) {
  const missing = input.records.filter((record) => record.isGoogleNative && record.likelyMissingFromManifest && record.includeForRag)
  if (missing.length === 0) {
    return 0
  }

  const rows = missing.map((record) => {
    const out = {
      source: "google_drive",
      remote: input.remote,
      path: record.path,
      name: record.name,
      extension: record.extension,
      sizeBytes: record.sizeBytes,
      modifiedTime: record.modifiedTime,
      include: true,
      status: "included",
      reason: "google_native_pending_export",
    }

    return JSON.stringify(out)
  })

  await appendFile(input.manifestPath, `${rows.join("\n")}\n`, "utf8")
  return missing.length
}

async function main() {
  await loadEnvLocalIfNeeded()

  const remote = process.env.GOOGLE_DRIVE_REMOTE?.trim()
  if (!remote) {
    throw new Error("Missing required env var: GOOGLE_DRIVE_REMOTE")
  }

  const runtimeManifestsDir = "/var/lib/aeonops/drive/manifests"
  await mkdir(runtimeManifestsDir, { recursive: true })

  const huntJsonlPath = join(runtimeManifestsDir, "google-native-docs-hunt.jsonl")
  const huntTsvPath = join(runtimeManifestsDir, "google-native-docs-hunt.tsv")
  const huntSummaryPath = join(runtimeManifestsDir, "google-native-docs-hunt-summary.json")

  const possibleManifestPaths = [
    join(runtimeManifestsDir, "google-drive-rag-manifest.jsonl"),
    "/home/aeon-rag/storage/manifests/google-drive-rag-manifest.jsonl",
  ]

  const coveredPaths = await readExistingManifestPaths(possibleManifestPaths)

  const entries = await runRcloneLsjson(remote)

  const extensionlessUnknown = entries.filter((entry) => {
    const path = normalizePath(entry.Path || "")
    const name = entry.Name || basename(path)
    const extension = extensionOf(name)
    const mimeType = getMimeType(entry)
    return !extension && !mimeType
  }).length

  let secondaryCheckCount = 0
  if (extensionlessUnknown > 0) {
    const lines = await runRcloneLsf(remote)
    secondaryCheckCount = lines.length
  }

  const records: HuntRecord[] = entries
    .filter((entry) => !entry.IsDir)
    .map((entry) => {
      const path = normalizePath(entry.Path || "")
      const name = entry.Name || basename(path)
      const extension = extensionOf(name)
      const sizeBytes = Number.isFinite(entry.Size) ? Number(entry.Size) : 0
      const mimeType = getMimeType(entry)
      const metadataHasGoogleApps = metadataLooksGoogleNative(entry)
      const covered = coveredPaths.has(path)

      return classifyRecord({
        remote,
        path,
        name,
        extension,
        sizeBytes,
        mimeType,
        modifiedTime: entry.ModTime ?? null,
        metadataHasGoogleApps,
        covered,
      })
    })

  const header = [
    "source",
    "remote",
    "path",
    "name",
    "extension",
    "sizeBytes",
    "mimeType",
    "modifiedTime",
    "isGoogleNative",
    "googleNativeType",
    "recommendedExport",
    "includeForRag",
    "reason",
    "classification",
    "alreadyCoveredByManifest",
    "likelyMissingFromManifest",
  ]

  await writeFile(huntJsonlPath, `${records.map((record) => JSON.stringify(record)).join("\n")}\n`, "utf8")
  await writeFile(huntTsvPath, `${header.join("\t")}\n${records.map((record) => toTsv(record)).join("\n")}\n`, "utf8")

  const googleNativeRecords = records.filter((record) => record.isGoogleNative)
  const missingGoogleNative = googleNativeRecords.filter((record) => record.likelyMissingFromManifest)

  const topFoldersMap = new Map<string, number>()
  for (const record of googleNativeRecords) {
    const key = folderKey(record.path)
    topFoldersMap.set(key, (topFoldersMap.get(key) ?? 0) + 1)
  }

  const exportCounts = new Map<string, number>()
  for (const record of missingGoogleNative) {
    exportCounts.set(record.recommendedExport, (exportCounts.get(record.recommendedExport) ?? 0) + 1)
  }

  const runtimeManifestPath = possibleManifestPaths[0]
  const addedToManifestCount = await upsertRuntimeManifestForMissingGoogleNative({
    records,
    manifestPath: runtimeManifestPath,
    remote,
  })

  const summary = {
    totalScanned: records.length,
    googleNativeTotal: googleNativeRecords.length,
    googleDocs: googleNativeRecords.filter((record) => record.googleNativeType === "google_doc").length,
    googleSheets: googleNativeRecords.filter((record) => record.googleNativeType === "google_sheet").length,
    googleSlides: googleNativeRecords.filter((record) => record.googleNativeType === "google_slide").length,
    googleDrawings: googleNativeRecords.filter((record) => record.googleNativeType === "google_drawing").length,
    googleForms: googleNativeRecords.filter((record) => record.googleNativeType === "google_form").length,
    googleUnknown: googleNativeRecords.filter((record) => record.googleNativeType === "google_unknown").length,
    suspiciousExtensionless: records.filter((record) => record.classification === "suspicious_extensionless").length,
    alreadyCoveredByManifest: googleNativeRecords.filter((record) => record.alreadyCoveredByManifest).length,
    likelyMissingFromManifest: missingGoogleNative.length,
    recommendedExports: [...exportCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([format, count]) => ({ format, count })),
    topFoldersContainingGoogleNativeDocs: [...topFoldersMap.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 20)
      .map(([folder, count]) => ({ folder, count })),
    sampleMissingGoogleNativeDocs: missingGoogleNative.slice(0, 25).map((record) => ({
      path: record.path,
      googleNativeType: record.googleNativeType,
      recommendedExport: record.recommendedExport,
      reason: record.reason,
    })),
    secondaryCheckLines: secondaryCheckCount,
    runtimeManifestPath,
    addedToManifestCount,
  }

  await writeFile(huntSummaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8")

  console.log(`Remote used: ${remote}`)
  console.log(`Scanned: ${summary.totalScanned}`)
  console.log(`Google-native total: ${summary.googleNativeTotal}`)
  console.log(`Likely missing from manifest: ${summary.likelyMissingFromManifest}`)
  console.log(`Hunt JSONL: ${huntJsonlPath}`)
  console.log(`Hunt TSV: ${huntTsvPath}`)
  console.log(`Hunt summary: ${huntSummaryPath}`)
  console.log(`Added to runtime manifest: ${summary.addedToManifestCount}`)
}

main().catch((error) => {
  const safeMessage = error instanceof Error ? error.message : "Unknown Google-native hunt failure"
  console.error(safeMessage)
  process.exit(1)
})
