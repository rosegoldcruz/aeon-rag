import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import pool from "@/lib/db"
import { getRuntimeStoragePaths } from "@/lib/tools/types"

export const runtime = "nodejs"

async function readWorkerStatus(statusPath: string) {
  try {
    return JSON.parse(await readFile(statusPath, "utf8")) as Record<string, unknown>
  } catch {
    return null
  }
}

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const runtimePaths = getRuntimeStoragePaths()
  const statusPath = join(runtimePaths.toolRuns, "drive-worker-status.json")

  try {
    const [status, latestJob] = await Promise.all([
      readWorkerStatus(statusPath),
      pool.query<{
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
      ),
    ])

    const latest = latestJob.rows[0]

    return NextResponse.json({
      ok: true,
      statusPath,
      worker: status,
      latestJob: latest
        ? {
            ...latest,
            scanned_count: Number(latest.scanned_count || "0"),
            attempted_count: Number(latest.attempted_count || "0"),
            imported_count: Number(latest.imported_count || "0"),
            skipped_count: Number(latest.skipped_count || "0"),
            failed_count: Number(latest.failed_count || "0"),
            error_count: Number(latest.error_count || "0"),
          }
        : null,
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown Drive worker status failure"
    console.error("[api/tools/drive/worker/status] failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to read Drive worker status.",
      },
      { status: 500 },
    )
  }
}