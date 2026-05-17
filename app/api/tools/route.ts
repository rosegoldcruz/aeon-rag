import { NextResponse } from "next/server"
import { getAuthenticatedSession, unauthorizedResponse } from "@/auth"
import { getToolRegistry } from "@/lib/tools/registry"

export const runtime = "nodejs"

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) {
    return unauthorizedResponse()
  }

  try {
    const registry = await getToolRegistry()
    return NextResponse.json({ ok: true, ...registry })
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : "Unknown tool registry failure"
    console.error("[api/tools] registry failed", { message: safeMessage })

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to load tool registry.",
      },
      { status: 500 },
    )
  }
}
