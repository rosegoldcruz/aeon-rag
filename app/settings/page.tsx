import { redirect } from "next/navigation"
import { getAuthenticatedSession } from "@/auth"
import { SettingsWorkspace } from "@/components/settings/settings-workspace"

export default async function SettingsPage() {
  const session = await getAuthenticatedSession()
  if (!session) {
    redirect("/login")
  }

  return (
    <main className="min-h-[100dvh] bg-background text-foreground">
      <SettingsWorkspace
        userName={session.user?.name || "User"}
        userEmail={session.user?.email || ""}
      />
    </main>
  )
}
