import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { appendFile, mkdir, open, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { config as loadDotenv } from "dotenv"

import pool from "@/lib/db"
import { getRuntimeStoragePaths } from "@/lib/tools/types"

type WorkerState = "disabled" | "idle" | "running" | "skipped" | "error"

type LatestJobSummary = {
  id: string
  status: string
  scannedCount: number
  attemptedCount: number
  importedCount: number
  skippedCount: number
  failedCount: number
  errorCount: number
  message: string | null
  startedAt: string
  finishedAt: string | null
}

type WorkerStatus = {
  ok: boolean
  workerId: string
  status: WorkerState
  enabled: boolean
  folder: string
  folderId: string | null
  limit: number
  intervalSeconds: number
  ext: string
  once: boolean
  lockPath: string
  logPath: string
  statusPath: string
  pid: number
  updatedAt: string
  lastStartedAt?: string
  lastFinishedAt?: string
  lastExitCode?: number | null
  lastError?: string | null
  lastJob?: LatestJobSummary | null
  message?: string
}

const DEFAULT_FOLDER = "AEON_Master_Intake"
const DEFAULT_LIMIT = 200
const DEFAULT_INTERVAL_SECONDS = 300
const DEFAULT_EXT = ".txt,.md,.json,.ts,.tsx,.py,.js,.pdf"

const workerId = randomUUID()

function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) {
    return defaultValue
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase())
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  const parsed = Number.parseInt(value || "", 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

async function appendLog(logPath: string, message: string) {
  const line = `[${new Date().toISOString()}] ${message}\n`
  process.stdout.write(line)
  await appendFile(logPath, line, "utf8")
}

async function readLock(lockPath: string): Promise<{ pid?: number } | null> {
  try {
    const raw = await readFile(lockPath, "utf8")
    return JSON.parse(raw) as { pid?: number }
  } catch {
    return null
  }
}

async function acquireLock(lockPath: string, logPath: string): Promise<boolean> {
  const existing = await readLock(lockPath)
  if (existing?.pid && isProcessAlive(existing.pid)) {
    await appendLog(logPath, `lock held by pid=${existing.pid}; skipping this cycle`)
    return false
  }

  if (existing) {
    await rm(lockPath, { force: true })
  }

  try {
    const handle = await open(lockPath, "wx")
    await handle.writeFile(
      JSON.stringify(
        {
          workerId,
          pid: process.pid,
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      ) + "\n",
      "utf8",
    )
    await handle.close()
    return true
  } catch {
    await appendLog(logPath, "lock already exists; skipping this cycle")
    return false
  }
}

async function latestJob(): Promise<LatestJobSummary | null> {
  const result = await pool.query<{
    id: string
    status: string
    scanned_count: string
    attempted_count: string
    imported_count: string
    skipped_count: string
    failed_count: string
    error_count: string
    message: string | null
    started_at: string
    finished_at: string | null
  }>(
    `
    SELECT
      id,
      status,
      scanned_count::text,
      attempted_count::text,
      imported_count::text,
      skipped_count::text,
      failed_count::text,
      error_count::text,
      message,
      started_at,
      finished_at
    FROM drive_import_jobs
    ORDER BY started_at DESC
    LIMIT 1
    `,
  )

  const row = result.rows[0]
  if (!row) {
    return null
  }

  return {
    id: row.id,
    status: row.status,
    scannedCount: Number(row.scanned_count || "0"),
    attemptedCount: Number(row.attempted_count || "0"),
    importedCount: Number(row.imported_count || "0"),
    skippedCount: Number(row.skipped_count || "0"),
    failedCount: Number(row.failed_count || "0"),
    errorCount: Number(row.error_count || "0"),
    message: row.message,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
  }
}

async function hasActiveJob(): Promise<boolean> {
  const result = await pool.query<{ id: string }>(
    `
    SELECT id
    FROM drive_import_jobs
    WHERE status = 'running'
    ORDER BY started_at DESC
    LIMIT 1
    `,
  )

  return Number(result.rowCount || 0) > 0
}

async function writeStatus(statusPath: string, status: WorkerStatus) {
  await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`, "utf8")
}

async function runIngest(params: {
  folder: string
  folderId: string | null
  limit: number
  ext: string
  logPath: string
}): Promise<number | null> {
  const args = ["run", "rag:drive:ingest", "--", "--limit", String(params.limit)]

  if (params.folderId) {
    args.push("--folder-id", params.folderId)
  } else {
    args.push("--folder", params.folder)
  }

  args.push("--ext", params.ext)

  await appendLog(params.logPath, `starting pnpm ${args.join(" ")}`)

  return new Promise((resolve, reject) => {
    const child = spawn("pnpm", args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    })

    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")

    child.stdout.on("data", (chunk: string) => {
      void appendFile(params.logPath, chunk, "utf8")
      process.stdout.write(chunk)
    })

    child.stderr.on("data", (chunk: string) => {
      void appendFile(params.logPath, chunk, "utf8")
      process.stderr.write(chunk)
    })

    child.on("error", (error) => reject(error))
    child.on("close", (code) => resolve(code))
  })
}

async function main() {
  loadDotenv({ path: ".env.local" })

  const runtime = getRuntimeStoragePaths()
  await mkdir(runtime.toolRuns, { recursive: true })

  const lockPath = join(runtime.toolRuns, "drive-worker.lock")
  const logPath = join(runtime.toolRuns, "drive-worker.log")
  const statusPath = join(runtime.toolRuns, "drive-worker-status.json")

  const enabled = parseBoolean(process.env.DRIVE_WORKER_ENABLED, false)
  const once = parseBoolean(process.env.DRIVE_WORKER_ONCE, false)
  const folder = process.env.DRIVE_WORKER_FOLDER?.trim() || DEFAULT_FOLDER
  const folderId = process.env.DRIVE_WORKER_FOLDER_ID?.trim() || null
  const limit = parsePositiveInteger(process.env.DRIVE_WORKER_LIMIT, DEFAULT_LIMIT)
  const intervalSeconds = parsePositiveInteger(process.env.DRIVE_WORKER_INTERVAL_SECONDS, DEFAULT_INTERVAL_SECONDS)
  const ext = process.env.DRIVE_WORKER_EXT?.trim() || DEFAULT_EXT

  const baseStatus = {
    ok: true,
    workerId,
    enabled,
    folder,
    folderId,
    limit,
    intervalSeconds,
    ext,
    once,
    lockPath,
    logPath,
    statusPath,
    pid: process.pid,
  }

  if (!enabled) {
    const latest = await latestJob()
    await appendLog(logPath, `Drive worker disabled; exiting cleanly folder=${folder} folderId=${folderId || "none"}`)
    await writeStatus(statusPath, {
      ...baseStatus,
      status: "disabled",
      updatedAt: new Date().toISOString(),
      lastJob: latest,
      message: "Drive worker disabled. Set DRIVE_WORKER_ENABLED=true to run.",
    })
    return
  }

  await appendLog(
    logPath,
    `Drive worker enabled folder=${folder} folderId=${folderId || "none"} limit=${limit} interval=${intervalSeconds}s once=${once}`,
  )

  do {
    const cycleStartedAt = new Date().toISOString()

    if (await hasActiveJob()) {
      const latest = await latestJob()
      await appendLog(logPath, "active Drive import job found; skipping this cycle")
      await writeStatus(statusPath, {
        ...baseStatus,
        status: "skipped",
        updatedAt: new Date().toISOString(),
        lastStartedAt: cycleStartedAt,
        lastFinishedAt: new Date().toISOString(),
        lastJob: latest,
        message: "Skipped because a Drive import job is already running.",
      })
    } else if (await acquireLock(lockPath, logPath)) {
      await writeStatus(statusPath, {
        ...baseStatus,
        status: "running",
        updatedAt: new Date().toISOString(),
        lastStartedAt: cycleStartedAt,
        lastJob: await latestJob(),
        message: "Drive ingestion batch is running.",
      })

      let exitCode: number | null = null
      let lastError: string | null = null

      try {
        exitCode = await runIngest({ folder, folderId, limit, ext, logPath })
        await appendLog(logPath, `ingest exited code=${exitCode}`)
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Unknown worker failure"
        await appendLog(logPath, `ingest failed: ${lastError}`)
      } finally {
        await rm(lockPath, { force: true })
      }

      const latest = await latestJob()
      await writeStatus(statusPath, {
        ...baseStatus,
        status: exitCode === 0 && !lastError ? "idle" : "error",
        updatedAt: new Date().toISOString(),
        lastStartedAt: cycleStartedAt,
        lastFinishedAt: new Date().toISOString(),
        lastExitCode: exitCode,
        lastError,
        lastJob: latest,
        message: exitCode === 0 && !lastError ? "Last Drive ingestion batch completed." : "Last Drive ingestion batch failed.",
      })
    }

    if (!once) {
      await sleep(intervalSeconds * 1000)
    }
  } while (!once)
}

main()
  .catch(async (error) => {
    const safe = error instanceof Error ? error.message : "Unknown Drive worker failure"
    const runtime = getRuntimeStoragePaths()
    await mkdir(runtime.toolRuns, { recursive: true })
    const logPath = join(runtime.toolRuns, "drive-worker.log")
    await appendLog(logPath, `fatal: ${safe}`)
    process.exit(1)
  })
  .finally(() => {
    void pool.end()
  })