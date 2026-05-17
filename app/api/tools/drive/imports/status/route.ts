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
    const [
      latestJob,
      jobStatusCounts,
      itemStatusCounts,
      failureStageCounts,
      failedItems,
      skippedItems,
      driveDocuments,
      driveChunks,
    ] = await Promise.all([
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
      pool.query<{ status: string; count: string }>(
        `
        SELECT status, COUNT(*)::text AS count
        FROM drive_import_jobs
        GROUP BY status
        ORDER BY status
        `,
      ),
      pool.query<{ status: string; count: string }>(
        `
        SELECT status, COUNT(*)::text AS count
        FROM drive_import_job_items
        GROUP BY status
        ORDER BY status
        `,
      ),
      pool.query<{ failure_stage: string | null; count: string }>(
        `
        SELECT failure_stage, COUNT(*)::text AS count
        FROM drive_import_job_items
        GROUP BY failure_stage
        ORDER BY COUNT(*) DESC, failure_stage ASC NULLS LAST
        `,
      ),
      pool.query<{
        job_id: string
        drive_path: string
        file_name: string | null
        failure_stage: string | null
        error: string | null
        updated_at: string
      }>(
        `
        SELECT
          job_id,
          drive_path,
          file_name,
          failure_stage,
          error,
          updated_at
        FROM drive_import_job_items
        WHERE status = 'failed'
        ORDER BY updated_at DESC
        LIMIT 10
        `,
      ),
      pool.query<{
        job_id: string
        drive_path: string
        file_name: string | null
        failure_stage: string | null
        error: string | null
        updated_at: string
      }>(
        `
        SELECT
          job_id,
          drive_path,
          file_name,
          failure_stage,
          error,
          updated_at
        FROM drive_import_job_items
        WHERE status = 'skipped'
        ORDER BY updated_at DESC
        LIMIT 10
        `,
      ),
      pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM documents
        WHERE source = 'google_drive'
        `,
      ),
      pool.query<{ count: string }>(
        `
        SELECT COUNT(*)::text AS count
        FROM document_chunks dc
        JOIN documents d ON d.id = dc.document_id
        WHERE d.source = 'google_drive'
        `,
      ),
    ])

    const mapCounts = <T extends { count: string }>(rows: Array<T>, key: (row: T) => string) => {
      return rows.reduce<Record<string, number>>((acc, row) => {
        acc[key(row)] = Number(row.count || "0")
        return acc
      }, {})
    }

    const latest = latestJob.rows[0]
    const stageCounts = mapCounts(failureStageCounts.rows, (row) => row.failure_stage || "none")
    const topFailureStage = failureStageCounts.rows[0]?.failure_stage || "none"

    return NextResponse.json({
      ok: true,
      hasRuns: Number(latestJob.rowCount || 0) > 0,
      latestStatus: latest?.status || null,
      lastRunTimestamp: latest?.started_at || null,
      latestJobSummary: latest
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
      jobCountsByStatus: mapCounts(jobStatusCounts.rows, (row) => row.status),
      itemCountsByStatus: mapCounts(itemStatusCounts.rows, (row) => row.status),
      itemCountsByFailureStage: stageCounts,
      topFailureStage,
      failedItemsCount: Number(mapCounts(itemStatusCounts.rows, (row) => row.status).failed || 0),
      skippedItemsCount: Number(mapCounts(itemStatusCounts.rows, (row) => row.status).skipped || 0),
      latestFailedItems: failedItems.rows,
      latestSkippedItems: skippedItems.rows,
      indexedDriveDocuments: Number(driveDocuments.rows[0]?.count || "0"),
      indexedDriveChunks: Number(driveChunks.rows[0]?.count || "0"),
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
