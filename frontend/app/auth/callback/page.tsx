"use client"
import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { setToken, setUser } from "@/lib/auth"

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const token = searchParams.get("token")
    const name = searchParams.get("name")
    const email = searchParams.get("email")
    const avatar = searchParams.get("avatar")

    if (token) {
      setToken(token)
      setUser({ id: 0, email: email || "", name: name || null, avatar_url: avatar || null, provider: "oauth", email_verified: true })
      // Fetch real user data will happen in layout
      router.push("/")
    } else {
      router.push("/login?error=auth_failed")
    }
  }, [router, searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div style={{ fontSize: 48, marginBottom: 16 }}>⟳</div>
        <p style={{ color: "var(--text-muted)" }}>Signing you in...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return <Suspense><CallbackContent /></Suspense>
}