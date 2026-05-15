"use client"
import { useState, useCallback } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { loginWithGoogle, loginWithGithub } from "@/lib/auth"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

function PasswordStrength({ password }: { password: string }) {
  const getStrength = () => {
    if (!password) return { score: 0, label: "", color: "" }
    let score = 0
    if (password.length >= 8) score++
    if (password.length >= 12) score++
    if (/[A-Z]/.test(password)) score++
    if (/[0-9]/.test(password)) score++
    if (/[^A-Za-z0-9]/.test(password)) score++

    if (score <= 1) return { score: 1, label: "Weak", color: "#f43f5e" }
    if (score <= 2) return { score: 2, label: "Fair", color: "#f59e0b" }
    if (score <= 3) return { score: 3, label: "Good", color: "#3b82f6" }
    if (score <= 4) return { score: 4, label: "Strong", color: "#10b981" }
    return { score: 5, label: "Very Strong", color: "#10b981" }
  }

  const { score, label, color } = getStrength()
  if (!password) return null

  const requirements = [
    { met: password.length >= 8, text: "8+ characters (required)" },
    { met: /[A-Z]/.test(password), text: "1 uppercase letter" },
    { met: /[a-z]{2,}/.test(password), text: "2+ lowercase letters" },
    { met: /[0-9]/.test(password), text: "1 number" },
    { met: /[^A-Za-z0-9]/.test(password), text: "1 special character" },
  ]

  return (
    <div style={{ marginTop: 8 }}>
      {/* Strength bars */}
      <div className="flex gap-1 mb-1">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 3,
            background: i <= score ? color : "rgba(255,255,255,0.1)",
            transition: "background 0.3s",
          }} />
        ))}
      </div>
      <div style={{ fontSize: 11, color, marginBottom: 8, fontWeight: 600 }}>{label}</div>

      {/* Requirements */}
      <div className="flex flex-col gap-1">
        {requirements.map((req, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: req.met ? "#10b981" : "var(--text-muted)" }}>
            <span>{req.met ? "✓" : "○"}</span>
            <span style={{ textDecoration: req.met ? "line-through" : "none", opacity: req.met ? 0.7 : 1 }}>{req.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const passwordMatch = confirmPassword.length > 0 && password === confirmPassword
  const passwordMismatch = confirmPassword.length > 0 && password !== confirmPassword

  const handleRegister = async () => {
    if (!name || !email || !password || !confirmPassword) { toast.error("All fields required"); return }
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return }
    if (password !== confirmPassword) { toast.error("Passwords don't match"); return }
    setLoading(true)
    try {
      const res = await fetch(`${BACKEND}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setDone(true)
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  const EyeIcon = ({ show }: { show: boolean }) => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {show ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        </>
      ) : (
        <>
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        </>
      )}
    </svg>
  )

  if (done) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <div className="glass-card text-center" style={{ maxWidth: 420, padding: 40 }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>✉️</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>Check your email!</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
            We sent a verification link to <strong style={{ color: "var(--violet-light)" }}>{email}</strong>. Click it to activate your account.
          </p>
          <Link href="/login" className="btn-primary-glow px-8 py-3 text-sm no-underline">Back to Login</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div className="text-center mb-8">
          <Link href="/" className="gradient-text text-[28px] font-extrabold tracking-[-0.5px] no-underline">ExamPredictor</Link>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8 }}>Create your free account</p>
        </div>

        <div className="glass-card" style={{ padding: 28 }}>
          <div className="flex flex-col gap-3 mb-6">
            <button onClick={loginWithGoogle} className="btn-ghost-muted py-3 text-sm flex items-center justify-center gap-3 w-full">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Sign up with Google
            </button>
            <button onClick={loginWithGithub} className="btn-ghost-muted py-3 text-sm flex items-center justify-center gap-3 w-full">
              <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0Z"/>
              </svg>
              Sign up with GitHub
            </button>
          </div>

          <div className="flex items-center gap-3 mb-5">
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>or email</span>
            <div style={{ flex: 1, height: 1, background: "var(--border-color)" }} />
          </div>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="form-input-styled" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" className="form-input-styled" />
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min 8 characters"
                  className="form-input-styled"
                  style={{ paddingRight: 44 }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>
              {password && <PasswordStrength password={password} />}
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Confirm Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  className="form-input-styled"
                  style={{
                    paddingRight: 44,
                    borderColor: passwordMatch ? "#10b981" : passwordMismatch ? "#f43f5e" : undefined,
                    boxShadow: passwordMatch ? "0 0 0 3px rgba(16,185,129,0.15)" : passwordMismatch ? "0 0 0 3px rgba(244,63,94,0.15)" : undefined,
                  }}
                  onKeyDown={e => e.key === "Enter" && handleRegister()}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", display: "flex" }}
                >
                  <EyeIcon show={showConfirm} />
                </button>
              </div>
              {confirmPassword.length > 0 && (
                <div style={{ fontSize: 11, fontWeight: 600, color: passwordMatch ? "#10b981" : "#f43f5e", display: "flex", alignItems: "center", gap: 4 }}>
                  {passwordMatch ? "✓ Passwords match" : "✗ Passwords don't match"}
                </div>
              )}
            </div>

            <button
              onClick={handleRegister}
              disabled={loading || !name || !email || !password || !confirmPassword || passwordMismatch}
              className="btn-primary-glow w-full py-3 text-sm"
            >
              {loading ? <><span className="inline-block animate-spin">⟳</span> Creating account...</> : "Create Account"}
            </button>
          </div>

          <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
            Already have an account?{" "}
            <Link href="/login" style={{ color: "var(--violet-light)", fontWeight: 600, textDecoration: "none" }}>Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}