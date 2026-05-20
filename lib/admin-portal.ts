import { randomUUID } from "node:crypto"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { Session } from "next-auth"
import { getAuthenticatedSession } from "@/auth"
import { getPool } from "@/lib/db"

export const ADMIN_PORTAL_COOKIE = "aeon_admin_session"
const ADMIN_SESSION_DURATION_HOURS = 8

type AdminSessionRow = {
  session_token: string
  user_key: string
  created_at: string
  expires_at: string
  revoked_at: string | null
}

export function getSessionUserKey(session: Session) {
  const email = session.user?.email?.trim().toLowerCase()
  if (email) {
    return email
  }

  return session.user?.name?.trim().toLowerCase() || "unknown-user"
}

function getAdminAllowlist() {
  const raw = process.env.ADMIN_ALLOWLIST_EMAILS || ""

  return raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
}

export function isAdminConfigured() {
  return Boolean(process.env.ADMIN_PORTAL_PASSPHRASE?.trim())
}

export function isSessionUserAdminAllowed(session: Session) {
  const allowlist = getAdminAllowlist()

  if (allowlist.length === 0) {
    return true
  }

  const email = session.user?.email?.trim().toLowerCase()
  if (!email) {
    return false
  }

  return allowlist.includes(email)
}

async function getAdminSessionByToken(sessionToken: string) {
  const pool = getPool()
  const result = await pool.query<AdminSessionRow>(
    `
    SELECT session_token, user_key, created_at, expires_at, revoked_at
    FROM admin_portal_sessions
    WHERE session_token = $1
    LIMIT 1
    `,
    [sessionToken],
  )

  return result.rows[0] || null
}

export async function createAdminPortalSession(userKey: string) {
  const sessionToken = randomUUID()
  const pool = getPool()

  const result = await pool.query<AdminSessionRow>(
    `
    INSERT INTO admin_portal_sessions (session_token, user_key, expires_at)
    VALUES ($1, $2, NOW() + ($3 || ' hours')::interval)
    RETURNING session_token, user_key, created_at, expires_at, revoked_at
    `,
    [sessionToken, userKey, String(ADMIN_SESSION_DURATION_HOURS)],
  )

  return result.rows[0]
}

export async function revokeAdminPortalSession(sessionToken: string) {
  const pool = getPool()
  await pool.query(
    `
    UPDATE admin_portal_sessions
    SET revoked_at = NOW()
    WHERE session_token = $1
    `,
    [sessionToken],
  )
}

export async function isCurrentRequestAdminAuthenticated() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return {
      ok: false,
      code: "not_authenticated",
      session: null,
      userKey: null,
    } as const
  }

  if (!isSessionUserAdminAllowed(session)) {
    return {
      ok: false,
      code: "not_allowed",
      session,
      userKey: getSessionUserKey(session),
    } as const
  }

  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_PORTAL_COOKIE)?.value

  if (!token) {
    return {
      ok: false,
      code: "missing_admin_session",
      session,
      userKey: getSessionUserKey(session),
    } as const
  }

  const adminSession = await getAdminSessionByToken(token)
  if (!adminSession) {
    return {
      ok: false,
      code: "invalid_admin_session",
      session,
      userKey: getSessionUserKey(session),
    } as const
  }

  if (adminSession.revoked_at) {
    return {
      ok: false,
      code: "revoked_admin_session",
      session,
      userKey: getSessionUserKey(session),
    } as const
  }

  const expiresAtMs = new Date(adminSession.expires_at).getTime()
  if (Number.isNaN(expiresAtMs) || expiresAtMs < Date.now()) {
    return {
      ok: false,
      code: "expired_admin_session",
      session,
      userKey: getSessionUserKey(session),
    } as const
  }

  return {
    ok: true,
    code: "ok",
    session,
    userKey: getSessionUserKey(session),
    adminSession,
  } as const
}

export async function requireAdminPageAccess(nextPath: string) {
  const state = await isCurrentRequestAdminAuthenticated()
  if (!state.ok) {
    redirect(`/admin/login?next=${encodeURIComponent(nextPath)}`)
  }

  return state
}

export async function writeAdminAuditEvent(action: string, userKey: string, details?: Record<string, unknown>) {
  const pool = getPool()
  await pool.query(
    `
    INSERT INTO admin_auth_events (action, user_key, details)
    VALUES ($1, $2, $3::jsonb)
    `,
    [action, userKey, JSON.stringify(details || {})],
  )
}
