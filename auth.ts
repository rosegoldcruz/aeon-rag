import { NextResponse } from "next/server"
import type { NextAuthOptions } from "next-auth"
import { getServerSession } from "next-auth"
import type { OAuthConfig } from "next-auth/providers/oauth"

type ZitadelProfile = {
  sub: string
  name?: string
  preferred_username?: string
  email?: string
  picture?: string
}

function requiredEnv(name: string, allowEmpty = false) {
  const value = process.env[name]

  if (value === undefined || (!allowEmpty && value.trim() === "")) {
    throw new Error(`Missing required env var: ${name}`)
  }

  return value.trim()
}

const issuer = requiredEnv("ZITADEL_ISSUER")
const wellKnown = requiredEnv("ZITADEL_WELLKNOWN")
const clientId = requiredEnv("ZITADEL_CLIENT_ID")
const clientSecret = requiredEnv("ZITADEL_CLIENT_SECRET", true)

const zitadelProvider: OAuthConfig<ZitadelProfile> = {
  id: "zitadel",
  name: "ZITADEL",
  type: "oauth",
  issuer,
  wellKnown,
  clientId,
  clientSecret: clientSecret || undefined,
  client: clientSecret ? undefined : { token_endpoint_auth_method: "none" },
  authorization: {
    params: {
      scope: "openid email profile",
    },
  },
  idToken: true,
  checks: ["pkce", "state"],
  profile(profile: ZitadelProfile) {
    return {
      id: profile.sub,
      name: profile.name || profile.preferred_username || profile.email || profile.sub,
      email: profile.email,
      image: profile.picture,
    }
  },
}

export const authOptions: NextAuthOptions = {
  secret: requiredEnv("AUTH_SECRET"),
  providers: [zitadelProvider],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
}

export async function getAuthenticatedSession() {
  return getServerSession(authOptions)
}

export function unauthorizedResponse() {
  return NextResponse.json(
    {
      ok: false,
      error: "Unauthorized",
    },
    { status: 401 },
  )
}