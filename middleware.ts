import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized: ({ token }) => Boolean(token),
  },
})

export const config = {
  matcher: [
    "/((?!login|api/auth|_next/static|_next/image|.*\\..*).*)",
  ],
}