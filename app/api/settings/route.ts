import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { getOrCreateUserSettings } from "@/lib/user-settings"

function getUserIdentity(session: NonNullable<Awaited<ReturnType<typeof getAuthenticatedSession>>>) {
  const email = session.user?.email?.trim().toLowerCase()
  const name = session.user?.name?.trim() || "User"

  return {
    userKey: email || name.toLowerCase(),
    profileName: name,
    email: session.user?.email || "",
  }
}

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  try {
    const identity = getUserIdentity(session)
    const settings = await getOrCreateUserSettings(identity.userKey, identity.profileName)

    return NextResponse.json({
      ok: true,
      settings,
      capabilities: {
        smsNotifications: false,
        passwordChange: false,
        twoFactor: false,
        sessionInventory: false,
        employeeDirectory: false,
        billingPortal: false,
      },
      user: {
        name: identity.profileName,
        email: identity.email,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings"
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
