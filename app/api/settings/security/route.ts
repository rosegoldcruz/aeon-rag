import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { updateUserSettingsSection } from "@/lib/user-settings"

function toPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  return value as Record<string, unknown>
}

export async function PATCH(request: Request) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  const userKey = session.user?.email?.trim().toLowerCase() || session.user?.name?.trim().toLowerCase() || "unknown-user"

  try {
    const body = await request.json().catch(() => null)
    const payload = toPayload(body)
    if (!payload) {
      return NextResponse.json({ ok: false, error: "Invalid payload" }, { status: 400 })
    }

    if (typeof payload.currentPassword === "string" || typeof payload.newPassword === "string") {
      return NextResponse.json(
        {
          ok: false,
          error: "Password management is handled by ZITADEL in this deployment.",
        },
        { status: 501 },
      )
    }

    const settings = await updateUserSettingsSection(userKey, "security", payload)
    return NextResponse.json({ ok: true, settings })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save security settings"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
