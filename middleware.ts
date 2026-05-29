import { withAuth, type NextRequestWithAuth } from "next-auth/middleware"
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server"

const authMiddleware = withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => Boolean(token),
  },
})

export default function middleware(request: NextRequest, event: NextFetchEvent) {
  if (request.nextUrl.pathname === "/api/chat") {
    const internalKey = request.headers.get("x-aeon-internal-key")?.trim()

    if (internalKey) {
      const expectedKey = process.env.AEON_INTERNAL_API_KEY?.trim()
      if (!expectedKey) {
        return NextResponse.json({ ok: false, error: "Missing required env var: AEON_INTERNAL_API_KEY" }, { status: 503 })
      }

      if (internalKey === expectedKey) {
        return NextResponse.next()
      }

      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
    }
  }

  return authMiddleware(request as NextRequestWithAuth, event)
}

export const config = {
  matcher: [
    "/((?!login|api/auth|api/health|api/files/upload|_next/static|_next/image|.*\\..*).*)",
  ],
}