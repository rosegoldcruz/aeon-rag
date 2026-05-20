import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/lib/admin-portal"

export default async function AdminHomePage() {
  const state = await requireAdminPageAccess("/admin")

  return (
    <AdminShell title="Overview" description="Administrative workspace for internal operations controls.">
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 text-sm md:p-6">
        <p>
          Signed in as <span className="font-medium">{state.userKey}</span>
        </p>
        <p className="mt-2 text-muted-foreground">
          Use the top links to inspect users, system runtime, integration status, and admin audit events.
        </p>
      </section>
    </AdminShell>
  )
}
