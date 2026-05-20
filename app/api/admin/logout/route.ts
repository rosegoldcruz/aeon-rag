import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { ADMIN_PORTAL_COOKIE, revokeAdminPortalSession, writeAdminAuditEvent } from "@/lib/admin-portal"

export async function POST() {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_PORTAL_COOKIE)?.value

  if (token) {
    await revokeAdminPortalSession(token)
  }

  await writeAdminAuditEvent("admin_logout", "unknown-user")

  const response = NextResponse.json({ ok: true })
  response.cookies.set({
    name: ADMIN_PORTAL_COOKIE,
    value: "",
    path: "/",
    expires: new Date(0),
  })

  return response
}
