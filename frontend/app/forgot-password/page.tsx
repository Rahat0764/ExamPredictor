"use client"
import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handle = async () => {
    if (!email) return
    setLoading(true)
    await fetch(`${BACKEND}/auth/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    })
    setSent(true)
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="text-center mb-8">
          <Link href="/" className="gradient-text text-[28px] font-extrabold tracking-[-0.5px] no-underline">ExamPredictor</Link>
        </div>
        <div className="glass-card" style={{ padding: 28 }}>
          {sent ? (
            <div className="text-center">
              <div style={{ fontSize: 48, marginBottom: 12 }}>✉️</div>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>If that email exists, we&apos;ve sent a reset link. Check your inbox.</p>
              <Link href="/login" className="btn-primary-glow inline-flex mt-6 px-6 py-3 text-sm no-underline">Back to Login</Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>Reset Password</h2>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="form-input-styled" onKeyDown={e => e.key === "Enter" && handle()} />
                </div>
                <button onClick={handle} disabled={loading || !email} className="btn-primary-glow w-full py-3 text-sm">
                  {loading ? "Sending..." : "Send Reset Link"}
                </button>
              </div>
              <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "var(--text-muted)" }}>
                <Link href="/login" style={{ color: "var(--violet-light)", textDecoration: "none" }}>← Back to Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}