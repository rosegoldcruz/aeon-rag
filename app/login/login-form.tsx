"use client"

import { signIn } from "next-auth/react"

import { Button } from "@/components/ui/button"

type LoginFormProps = {
  callbackUrl: string
}

export function LoginForm({ callbackUrl }: LoginFormProps) {
  return (
    <Button className="h-11 w-full" onClick={() => signIn("zitadel", { callbackUrl })}>
      Continue with ZITADEL
    </Button>
  )
}