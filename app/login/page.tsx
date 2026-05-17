import { LoginForm } from "./login-form"

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string
  }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const callbackUrl = params?.callbackUrl || "/"

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background px-6">
      <div className="absolute inset-0 bg-gradient-to-br from-black via-gray-950 to-black" />
      <div className="absolute inset-0 opacity-[0.15] grid-background" />

      <section className="relative z-10 flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border/50 bg-background/70 p-6 text-center shadow-2xl backdrop-blur-md">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-normal text-foreground">AEON Ops</h1>
          <p className="text-sm text-muted-foreground">Private access requires ZITADEL authentication.</p>
        </div>

        <LoginForm callbackUrl={callbackUrl} />
      </section>
    </main>
  )
}