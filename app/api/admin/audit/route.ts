import { NextResponse } from "next/server"
import { isCurrentRequestAdminAuthenticated } from "@/lib/admin-portal"
import { getPool } from "@/lib/db"

export async function GET() {
  const adminState = await isCurrentRequestAdminAuthenticated()
  if (!adminState.ok) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const result = await getPool().query<{
    id: string
    action: string
    user_key: string
    details: unknown
    created_at: string
  }>(
    `
    SELECT id, action, user_key, details, created_at
    FROM admin_auth_events
    ORDER BY created_at DESC
    LIMIT 100
    `,
  )

  return NextResponse.json({
    ok: true,
    events: result.rows,
  })
}
