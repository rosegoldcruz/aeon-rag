import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/lib/admin-portal"

export default async function AdminUsersPage() {
  const state = await requireAdminPageAccess("/admin/users")

  return (
    <AdminShell title="Users" description="User and role administration.">
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 text-sm md:p-6">
        <p>Current authenticated user: {state.userKey}</p>
        <p className="mt-2 text-muted-foreground">
          Employee directory and role-management APIs are not present in this repository yet. This page is intentionally read-only until those backend endpoints exist.
        </p>
      </section>
    </AdminShell>
  )
}
