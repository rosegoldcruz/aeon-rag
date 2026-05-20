import { NextResponse } from "next/server"
import { isCurrentRequestAdminAuthenticated } from "@/lib/admin-portal"
import { getPool } from "@/lib/db"

export async function GET() {
  const adminState = await isCurrentRequestAdminAuthenticated()
  if (!adminState.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  let databaseHealthy = false
  let databaseError = ""

  try {
    await getPool().query("SELECT 1")
    databaseHealthy = true
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "DB check failed"
  }

  return NextResponse.json({
    ok: true,
    system: {
      nodeEnv: process.env.NODE_ENV || "development",
      appVersion: process.env.npm_package_version || "0.0.0",
      databaseHealthy,
      databaseError,
      modules: {
        chat: true,
        dashboard: false,
        tasks: false,
        projectionCalendar: false,
        requests: false,
        workOrders: false,
        reports: false,
      },
    },
  })
}
