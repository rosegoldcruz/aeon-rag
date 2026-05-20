import { NextResponse } from "next/server"
import { getAuthenticatedSession } from "@/auth"
import { isAdminConfigured, isCurrentRequestAdminAuthenticated, isSessionUserAdminAllowed } from "@/lib/admin-portal"

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      reason: "not_authenticated",
      configured: isAdminConfigured(),
    })
  }

  if (!isSessionUserAdminAllowed(session)) {
    return NextResponse.json({
      ok: true,
      authenticated: false,
      reason: "not_allowed",
      configured: isAdminConfigured(),
    })
  }

  const state = await isCurrentRequestAdminAuthenticated()

  return NextResponse.json({
    ok: true,
    authenticated: state.ok,
    reason: state.code,
    configured: isAdminConfigured(),
    user: {
      name: session.user?.name || "User",
      email: session.user?.email || "",
    },
  })
}
