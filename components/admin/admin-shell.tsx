import type { ReactNode } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

type Props = {
  title: string
  description: string
  children: ReactNode
}

export function AdminShell({ title, description, children }: Props) {
  return (
    <main className="min-h-[100dvh] bg-background p-4 text-foreground md:p-8">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <header className="rounded-xl border border-border/70 bg-card/60 p-4 md:p-6">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Admin Portal</p>
          <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/admin">Overview</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/users">Users</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/system">System</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/integrations">Integrations</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/audit">Audit</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/settings">Settings</Link>
            </Button>
          </div>
        </header>
        {children}
      </div>
    </main>
  )
}
