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
      status: "cli_only",
      message: "Drive ingestion is currently CLI-only.",
    },
    { status: 200 },
  )
}
