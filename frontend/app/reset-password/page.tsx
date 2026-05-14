"use client"
import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

function ResetContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [loading, setLoading] = useState(false)
  const token = searchParams.get("token") || ""

  const handle = async () => {
    if (password !== confirm) { toast.error("Passwords don't match"); return }
    if (password.length < 8) { toast.error("Min 8 characters"); return }
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      toast.success("Password reset! Please log in.")
      router.push("/login")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div className="text-center mb-8">
          <Link href="/" className="gradient-text text-[28px] font-extrabold tracking-[-0.5px] no-underline">ExamPredictor</Link>
        </div>
        <div className="glass-card" style={{ padding: 28 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16, color: "var(--text-primary)" }}>New Password</h2>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>New Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Min 8 characters" className="form-input-styled" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" className="form-input-styled" onKeyDown={e => e.key === "Enter" && handle()} />
            </div>
            <button onClick={handle} disabled={loading || !password || !confirm} className="btn-primary-glow w-full py-3 text-sm">
              {loading ? "Resetting..." : "Reset Password"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return <Suspense><ResetContent /></Suspense>
}