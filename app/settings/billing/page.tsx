import Link from "next/link"
import { redirect } from "next/navigation"
import { getAuthenticatedSession } from "@/auth"
import { Button } from "@/components/ui/button"

export default async function BillingPage() {
  const session = await getAuthenticatedSession()
  if (!session) {
    redirect("/login")
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-xl rounded-xl border border-border/70 bg-card/60 p-6">
        <h1 className="text-xl font-semibold">Billing</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Billing and subscription management are not configured in this deployment. No payment provider integration is present.
        </p>
        <div className="mt-6">
          <Button asChild>
            <Link href="/settings">Back to Settings</Link>
          </Button>
        </div>
      </section>
    </main>
  )
}
