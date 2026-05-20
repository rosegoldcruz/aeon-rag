import { Suspense } from "react"
import { AdminLoginClient } from "@/components/admin/admin-login-client"

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<main className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-foreground">Loading...</main>}>
      <AdminLoginClient />
    </Suspense>
  )
}
