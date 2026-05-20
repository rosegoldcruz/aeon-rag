"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function AdminLoginClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get("next") || "/admin"

  const [passphrase, setPassphrase] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<"checking" | "ready">("checking")

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" })
        const payload = (await response.json()) as {
          authenticated: boolean
          configured: boolean
        }

        if (!cancelled && payload.authenticated) {
          router.replace(next)
          return
        }

        if (!cancelled && !payload.configured) {
          toast.error("Admin portal is not configured: missing ADMIN_PORTAL_PASSPHRASE")
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to check admin session state")
        }
      } finally {
        if (!cancelled) {
          setStatus("ready")
        }
      }
    }

    void check()

    return () => {
      cancelled = true
    }
  }, [next, router])

  async function handleLogin() {
    if (!passphrase.trim()) {
      toast.error("Enter admin passphrase")
      return
    }

    setLoading(true)
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase }),
      })

      const payload = (await response.json()) as { ok: boolean; error?: string }
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Admin login failed")
      }

      toast.success("Admin session started")
      router.replace(next)
    } catch (error) {
      const message = error instanceof Error ? error.message : "Admin login failed"
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" })
    toast.success("Admin session cleared")
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background p-6 text-foreground">
      <section className="w-full max-w-md space-y-4 rounded-xl border border-border/70 bg-card/60 p-6">
        <h1 className="text-xl font-semibold">Admin Portal Login</h1>
        <p className="text-sm text-muted-foreground">
          This is a second gate after base login. Access requires a server-side admin passphrase.
        </p>

        <label className="block text-sm">
          <span className="mb-1 block text-muted-foreground">Admin Passphrase</span>
          <input
            type="password"
            className="w-full rounded-md border border-border bg-background px-3 py-2"
            value={passphrase}
            onChange={(event) => setPassphrase(event.target.value)}
            disabled={status !== "ready" || loading}
          />
        </label>

        <div className="flex gap-2">
          <Button onClick={handleLogin} disabled={loading || status !== "ready"}>
            {loading ? "Signing in..." : "Enter Admin Portal"}
          </Button>
          <Button variant="outline" onClick={handleLogout} disabled={loading}>
            Clear Admin Session
          </Button>
        </div>

        <div className="pt-2 text-sm text-muted-foreground">
          <Link className="underline underline-offset-4" href="/settings">
            Back to Settings
          </Link>
        </div>
      </section>
    </main>
  )
}
