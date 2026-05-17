import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import pool from "@/lib/db"

export const runtime = "nodejs"

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  try {
    const [latest, totals, recentJobs, recentItems] = await Promise.all([
      pool.query<{
        id: string
        status: string
        message: string | null
        started_at: string
        finished_at: string | null
        imported_count: number
        failed_count: number
        skipped_count: number
        attempted_count: number
      }>(
        `
        SELECT id, status, message, started_at, finished_at, imported_count, failed_count, skipped_count, attempted_count
        FROM drive_import_jobs
        ORDER BY started_at DESC
        LIMIT 1
        `,
      ),
      pool.query<{
        jobs: string
        imported: string
        failed: string
        skipped: string
      }>(
        `
        SELECT
          COUNT(*)::text AS jobs,
          COALESCE(SUM(imported_count), 0)::text AS imported,
          COALESCE(SUM(failed_count), 0)::text AS failed,
          COALESCE(SUM(skipped_count), 0)::text AS skipped
        FROM drive_import_jobs
        `,
      ),
      pool.query<{
        id: string
        status: string
        started_at: string
        finished_at: string | null
        scanned_count: string
        attempted_count: string
        imported_count: string
        skipped_count: string
        failed_count: string
        message: string | null
      }>(
        `
        SELECT
          id,
          status,
          started_at,
          finished_at,
          scanned_count::text,
          attempted_count::text,
          imported_count::text,
          skipped_count::text,
          failed_count::text,
          message
        FROM drive_import_jobs
        ORDER BY started_at DESC
        LIMIT 10
        `,
      ),
      pool.query<{
        id: string
        job_id: string
        drive_path: string
        file_name: string | null
        status: string
        failure_stage: string | null
        error: string | null
        chunk_count: string | null
        updated_at: string
      }>(
        `
        SELECT
          id,
          job_id,
          drive_path,
          file_name,
          status,
          failure_stage,
          error,
          chunk_count::text,
          updated_at
        FROM drive_import_job_items
        ORDER BY updated_at DESC
        LIMIT 25
        `,
      ),
    ])

    const row = totals.rows[0]

    return NextResponse.json({
      ok: true,
      totals: {
        jobs: Number(row?.jobs || "0"),
        imported: Number(row?.imported || "0"),
        failed: Number(row?.failed || "0"),
        skipped: Number(row?.skipped || "0"),
      },
      latestJob: latest.rows[0] || null,
      recentJobs: recentJobs.rows.map((job) => ({
        ...job,
        scanned_count: Number(job.scanned_count || "0"),
        attempted_count: Number(job.attempted_count || "0"),
        imported_count: Number(job.imported_count || "0"),
        skipped_count: Number(job.skipped_count || "0"),
        failed_count: Number(job.failed_count || "0"),
      })),
      recentItems: recentItems.rows.map((item) => ({
        ...item,
        chunk_count: item.chunk_count === null ? null : Number(item.chunk_count),
      })),
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown drive imports failure"
    console.error("[api/tools/drive/imports] failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load Drive imports.",
      },
      { status: 500 },
    )
  }
}
