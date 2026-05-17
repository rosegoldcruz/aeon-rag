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
    const [jobs, docs] = await Promise.all([
      pool.query<{
        status: string
      }>(
        `
        SELECT status
        FROM drive_import_jobs
        ORDER BY started_at DESC
        LIMIT 1
        `,
      ),
      pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM documents
        WHERE source = 'google_drive' AND status = 'indexed'
        `,
      ),
    ])

    return NextResponse.json({
      ok: true,
      hasRuns: Number(jobs.rowCount || 0) > 0,
      latestStatus: jobs.rows[0]?.status || null,
      indexedDriveDocuments: Number(docs.rows[0]?.count || "0"),
    })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown drive imports status failure"
    console.error("[api/tools/drive/imports/status] failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to read Drive imports status.",
      },
      { status: 500 },
    )
  }
}
