import { access } from "node:fs/promises"
import { constants } from "node:fs"
import { AdminShell } from "@/components/admin/admin-shell"
import { requireAdminPageAccess } from "@/lib/admin-portal"
import { getPool } from "@/lib/db"

async function canWrite(path: string) {
  try {
    await access(path, constants.W_OK)
    return true
  } catch {
    return false
  }
}

export default async function AdminIntegrationsPage() {
  await requireAdminPageAccess("/admin/integrations")

  let dbStatus = "error"
  try {
    await getPool().query("SELECT 1")
    dbStatus = "connected"
  } catch {
    dbStatus = "error"
  }

  const checks = [
    ["PostgreSQL", dbStatus, process.env.POSTGRES_URL ? "configured" : "POSTGRES_URL missing"],
    ["NocoDB", process.env.NOCODB_URL ? "configured" : "missing", process.env.NOCODB_URL || "NOCODB_URL missing"],
    ["n8n", process.env.N8N_URL ? "configured" : "missing", process.env.N8N_URL || "N8N_URL missing"],
    [
      "AI Provider",
      process.env.GOOGLE_VERTEX_PROJECT ? "configured" : "missing",
      process.env.GOOGLE_VERTEX_PROJECT || "GOOGLE_VERTEX_PROJECT missing",
    ],
    [
      "Outlook",
      process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID ? "configured" : "missing",
      process.env.OUTLOOK_CLIENT_ID || process.env.MICROSOFT_CLIENT_ID || "OUTLOOK_CLIENT_ID/MICROSOFT_CLIENT_ID missing",
    ],
    ["File Storage", (await canWrite("/var/lib/aeonops/uploads")) ? "writable" : "readonly_or_missing", "/var/lib/aeonops/uploads"],
  ] as const

  return (
    <AdminShell title="Integrations" description="External dependency status and configuration coverage.">
      <section className="rounded-xl border border-border/70 bg-card/60 p-4 text-sm md:p-6">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border/70 text-muted-foreground">
              <th className="py-2">Integration</th>
              <th className="py-2">Status</th>
              <th className="py-2">Note</th>
            </tr>
          </thead>
          <tbody>
            {checks.map(([name, status, note]) => (
              <tr key={name} className="border-b border-border/50">
                <td className="py-2">{name}</td>
                <td className="py-2">{status}</td>
                <td className="py-2 text-muted-foreground">{note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </AdminShell>
  )
}
