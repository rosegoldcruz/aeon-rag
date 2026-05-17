import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"

export const runtime = "nodejs"

export async function POST() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  return NextResponse.json(
    {
      ok: false,
      cliOnly: true,
      error: "Drive ingestion is CLI-only for safety. Run: pnpm run rag:drive:ingest -- --limit 10",
    },
    { status: 409 },
  )
}
