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
    const [latest, totals] = await Promise.all([
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
