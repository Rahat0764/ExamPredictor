"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { getToken, getUser, setUser, removeToken, fetchMe, type User } from "@/lib/auth"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUserState] = useState<User | null>(null)
  const [name, setName] = useState("")
  const [avatarUrl, setAvatarUrl] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchMe().then(u => {
      if (!u) { router.push("/login"); return }
      setUserState(u)
      setName(u.name || "")
      setAvatarUrl(u.avatar_url || "")
      setLoading(false)
    })
  }, [router])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name, avatar_url: avatarUrl }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setUser(data.user)
      setUserState(data.user)
      toast.success("Profile updated! ✅")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    removeToken()
    toast.success("Logged out")
    router.push("/login")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <span style={{ color: "var(--text-muted)" }}>Loading profile...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }} className="hover:text-[var(--violet-light)]">← Back</Link>
        <h1 className="text-[28px] font-extrabold tracking-[-0.5px] mt-3 mb-1" style={{ color: "var(--text-primary)" }}>👤 Profile</h1>
      </div>

      {/* Avatar preview */}
      <div className="glass-card" style={{ padding: 28 }}>
        <div className="flex items-center gap-4 mb-6">
          {avatarUrl ? (
            <img src={avatarUrl} alt="avatar" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--border-hover)" }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, var(--violet), var(--indigo))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, fontWeight: 700, color: "white" }}>
              {name?.[0]?.toUpperCase() || "?"}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>{user?.name || "User"}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user?.email}</div>
            <div style={{ fontSize: 11, marginTop: 4, padding: "2px 8px", borderRadius: 20, background: "rgba(139,92,246,0.1)", color: "var(--violet-light)", display: "inline-block" }}>
              via {user?.provider}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Display Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name" className="form-input-styled" />
          </div>

          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Avatar URL (optional)</label>
            <input type="url" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://example.com/photo.jpg" className="form-input-styled" />
            <p style={{ fontSize: 11, color: "var(--text-muted)" }}>Paste a direct image URL, or leave blank for initials avatar</p>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-primary-glow w-full py-3 text-sm">
            {saving ? <><span className="inline-block animate-spin">⟳</span> Saving...</> : "💾 Save Changes"}
          </button>
        </div>
      </div>

      {/* Account info */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>Account</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
          Email: <span style={{ color: "var(--text-primary)" }}>{user?.email}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Email verified: <span style={{ color: user?.email_verified ? "var(--emerald)" : "var(--amber)" }}>
            {user?.email_verified ? "✅ Yes" : "⚠️ No"}
          </span>
        </div>
        <button
          onClick={handleLogout}
          style={{ fontSize: 13, color: "var(--rose)", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 10, padding: "8px 16px", cursor: "pointer" }}
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  )
}