import { redirect } from "next/navigation"
import { getAuthenticatedSession } from "@/auth"
import { ChatArea } from "@/components/chat-area"

export default async function Home() {
  const session = await getAuthenticatedSession()

  if (!session) {
    redirect("/login")
  }

  return (
    <div className="flex min-h-[100dvh] w-full overflow-x-hidden bg-background">
      <ChatArea />
    </div>
  )
}
