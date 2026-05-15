"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { getToken, getUser, setUser, removeToken, fetchMe, type User } from "@/lib/auth"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

export default function ProfilePage() {
  const router = useRouter()
  const [user, setUserState] = useState<User | null>(null)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchMe().then(u => {
      if (!u) { router.push("/login"); return }
      setUserState(u)
      setName(u.name || "")
      setLoading(false)
    })
  }, [router])

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) { toast.error("Image too large. Max 5MB."); return }

    // Preview
    const reader = new FileReader()
    reader.onload = ev => setAvatarPreview(ev.target?.result as string)
    reader.readAsDataURL(file)

    // Upload to Drive
    setUploadingAvatar(true)
    try {
      const formData = new FormData()
      formData.append("avatar", file)

      const res = await fetch(`${BACKEND}/auth/profile/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); setAvatarPreview(null); return }
      setUser(data.user)
      setUserState(data.user)
      toast.success("Profile picture updated! ✅")
    } catch (e: any) {
      toast.error(e.message)
      setAvatarPreview(null)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSaveName = async () => {
    if (!name.trim() || name.trim().length < 2) { toast.error("Name too short"); return }
    setSaving(true)
    try {
      const res = await fetch(`${BACKEND}/auth/profile`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (data.error) { toast.error(data.error); return }
      setUser(data.user)
      setUserState(data.user)
      toast.success("Name updated! ✅")
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div style={{ color: "var(--text-muted)" }}>Loading profile...</div>
      </div>
    )
  }

  const displayAvatar = avatarPreview || user?.avatar_url

  return (
    <div className="flex flex-col gap-6 max-w-xl mx-auto">
      <div>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }} className="hover:text-[var(--violet-light)]">← Back</Link>
        <h1 className="text-[28px] font-extrabold tracking-[-0.5px] mt-3 mb-1" style={{ color: "var(--text-primary)" }}>👤 Profile</h1>
      </div>

      <div className="glass-card" style={{ padding: 28 }}>
        {/* Avatar upload */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div style={{ position: "relative" }}>
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt="avatar"
                style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "3px solid var(--border-hover)" }}
              />
            ) : (
              <div style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(135deg, var(--violet), var(--indigo))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, fontWeight: 700, color: "white", border: "3px solid var(--border-hover)" }}>
                {name?.[0]?.toUpperCase() || "?"}
              </div>
            )}

            {/* Upload overlay button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              style={{
                position: "absolute", bottom: 0, right: 0,
                width: 30, height: 30, borderRadius: "50%",
                background: "linear-gradient(135deg, var(--violet), var(--indigo))",
                border: "2px solid var(--bg)",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 14,
              }}
              title="Change photo"
            >
              {uploadingAvatar ? <span className="inline-block animate-spin" style={{ fontSize: 12 }}>⟳</span> : "📷"}
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="text-center">
            <div style={{ fontWeight: 700, fontSize: 18, color: "var(--text-primary)" }}>{user?.name}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{user?.email}</div>
            <div style={{ fontSize: 11, marginTop: 4, padding: "2px 8px", borderRadius: 20, background: "rgba(139,92,246,0.1)", color: "var(--violet-light)", display: "inline-block" }}>
              via {user?.provider}
            </div>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingAvatar}
            className="btn-ghost-muted px-4 py-2 text-sm"
            style={{ fontSize: 12 }}
          >
            {uploadingAvatar ? "Uploading..." : "📷 Change Profile Photo"}
          </button>
        </div>

        {/* Name edit */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Display Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Your name"
              className="form-input-styled"
              onKeyDown={e => e.key === "Enter" && handleSaveName()}
            />
          </div>
          <button onClick={handleSaveName} disabled={saving || !name.trim()} className="btn-primary-glow w-full py-3 text-sm">
            {saving ? <><span className="inline-block animate-spin">⟳</span> Saving...</> : "💾 Save Name"}
          </button>
        </div>
      </div>

      {/* Account info */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 }}>Account Info</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
          Email: <span style={{ color: "var(--text-primary)" }}>{user?.email}</span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          Verified: <span style={{ color: user?.email_verified ? "#10b981" : "#f59e0b" }}>
            {user?.email_verified ? "✅ Yes" : "⚠️ No"}
          </span>
        </div>
        <button
          onClick={() => { removeToken(); toast.success("Logged out"); router.push("/login") }}
          style={{ fontSize: 13, color: "var(--rose)", background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.3)", borderRadius: 10, padding: "8px 16px", cursor: "pointer" }}
        >
          🚪 Sign Out
        </button>
      </div>
    </div>
  )
}