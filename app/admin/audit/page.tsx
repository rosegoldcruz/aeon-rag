import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/lib/admin-portal"
import { getPool } from "@/lib/db"

type EventRow = {
  id: string
  action: string
  user_key: string
  details: Record<string, unknown>
  created_at: string
}

export default async function AdminAuditPage() {
  await requireAdminPageAccess("/admin/audit")

  const result = await getPool().query<EventRow>(
    `
    SELECT id, action, user_key, details, created_at
    FROM admin_auth_events
    ORDER BY created_at DESC
    LIMIT 100
    `,
  )

  return (
    <AdminShell title="Audit" description="Recent administrative authentication events.">
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 text-sm md:p-6">
        {result.rows.length === 0 ? (
          <p className="text-muted-foreground">No admin audit events recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {result.rows.map((event) => (
              <div key={event.id} className="rounded-md border border-border/60 bg-background/50 p-3">
                <p className="font-medium">{event.action}</p>
                <p className="text-xs text-muted-foreground">{event.user_key}</p>
                <p className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  )
}
