import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import {
  ADMIN_PORTAL_COOKIE,
  createAdminPortalSession,
  getSessionUserKey,
  isAdminConfigured,
  isSessionUserAdminAllowed,
  writeAdminAuditEvent,
} from "@/lib/admin-portal"

type RequestBody = {
  passphrase?: string
}

export async function POST(request: Request) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const userKey = getSessionUserKey(session)

  if (!isSessionUserAdminAllowed(session)) {
    await writeAdminAuditEvent("admin_login_denied_allowlist", userKey)
    return NextResponse.json(
      {
        ok: false,
        error: "Your account is not allowed to access Admin Portal.",
      },
      { status: 403 },
    )
  }

  if (!isAdminConfigured()) {
    await writeAdminAuditEvent("admin_login_denied_not_configured", userKey)
    return NextResponse.json(
      {
        ok: false,
        error: "Admin portal is not configured. Set ADMIN_PORTAL_PASSPHRASE.",
      },
      { status: 503 },
    )
  }

  const body = (await request.json().catch(() => null)) as RequestBody | null
  const passphrase = body?.passphrase?.trim() || ""

  if (!passphrase) {
    return NextResponse.json({ ok: false, error: "Passphrase is required." }, { status: 400 })
  }

  if (passphrase !== process.env.ADMIN_PORTAL_PASSPHRASE?.trim()) {
    await writeAdminAuditEvent("admin_login_denied_bad_passphrase", userKey)
    return NextResponse.json({ ok: false, error: "Invalid passphrase." }, { status: 401 })
  }

  const adminSession = await createAdminPortalSession(userKey)
  await writeAdminAuditEvent("admin_login_success", userKey)

  const response = NextResponse.json({
    ok: true,
    expiresAt: adminSession.expires_at,
  })

  response.cookies.set({
    name: ADMIN_PORTAL_COOKIE,
    value: adminSession.session_token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(adminSession.expires_at),
  })

  return response
}
