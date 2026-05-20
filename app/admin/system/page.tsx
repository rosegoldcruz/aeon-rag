import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/lib/admin-portal"
import { getPool } from "@/lib/db"

export default async function AdminSystemPage() {
  await requireAdminPageAccess("/admin/system")

  let databaseHealthy = false
  let databaseError = ""
  try {
    await getPool().query("SELECT 1")
    databaseHealthy = true
  } catch (error) {
    databaseError = error instanceof Error ? error.message : "Database probe failed"
  }

  return (
    <AdminShell title="System" description="Runtime and module health overview.">
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 text-sm md:p-6">
        <div className="space-y-2">
          <p>
            Node Environment: <span className="font-medium">{process.env.NODE_ENV || "development"}</span>
          </p>
          <p>
            Database: <span className="font-medium">{databaseHealthy ? "healthy" : "error"}</span>
          </p>
          {!databaseHealthy && databaseError ? <p className="text-red-400">{databaseError}</p> : null}
          <p className="text-muted-foreground">Enabled modules: chat.</p>
          <p className="text-muted-foreground">Missing modules: dashboard, tasks, projection calendar, requests, work orders, reports.</p>
        </div>
      </section>
    </AdminShell>
  )
}
