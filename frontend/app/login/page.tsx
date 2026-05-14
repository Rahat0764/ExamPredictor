"use client"
import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { loginWithGoogle, loginWithGithub, setToken, setUser } from "@/lib/auth"
import { Suspense } from "react"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [needsVerification, setNeedsVerification] = useState(false)

  useEffect(() => {
    const error = searchParams.get("error")
    if (error === "google_failed") toast.error("Google login failed. Try again.")
    if (error === "github_failed") toast.error("GitHub login failed. Try again.")
    if (error === "invalid_token") toast.error("Verification link expired.")
  }, [searchParams])

  const handleLogin = async () => {
    if (!email || !password) return
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (data.error) {
        if (data.needsVerification) setNeedsVerification(true)
        toast.error(data.error)
        return
      }
      setToken(data.token)
      setUser(data.user)
      toast.success(`Welcome back, ${data.user.name || "there"}! 🎉`)
      router.push("/")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const resendVerification = async () => {
    await fetch(`${BACKEND}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    toast.success("Verification email sent!")
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="text-center mb-8">
          <Link href="/" className="gradient-text text-[28px] font-extrabold tracking-[-0.5px] no-underline">
            ExamPredictor
          </Link>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>Sign in to continue</p>
        </div>

        <div className="glass-card" style={{ padding: 28 }}>
          {/* Social login */}
          <div className="flex flex-col gap-3 mb-6">
            <button
              onClick={loginWithGoogle}
              className="btn-ghost-muted py-3 text-sm flex items-center justify-center gap-3 w-full"
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
            <button
              onClick={loginWithGithub}
              className="btn-ghost-muted py-3 text-sm flex items-center justify-center gap-3 w-full"
            >
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0Z"/>
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="form-input-styled"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Password</label>
                <Link href="/forgot-password" style={{ fontSize: 12, color: "var(--violet-light)", textDecoration: "none" }}>
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="form-input-styled"
                onKeyDown={e => e.key === "Enter" && handleLogin()}
              />
            </div>

            {needsVerification && (
              <div style={{ padding: "12px 16px", borderRadius: 12, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", fontSize: 13, color: "#fcd34d" }}>
                ✉️ Email not verified.{" "}
                <button onClick={resendVerification} style={{ color: "var(--violet-light)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Resend verification email
                </button>
              </div>
            )}

            <button
              onClick={handleLogin}
              disabled={loading || !email || !password}
              className="btn-primary-glow w-full py-3 text-sm"
            >
              {loading ? <><span className="inline-block animate-spin">⟳</span> Signing in...</> : "Sign In"}
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
            Don&apos;t have an account?{" "}
            <Link href="/register" style={{ color: "var(--violet-light)", fontWeight: 600, textDecoration: "none" }}>
              Sign up free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}