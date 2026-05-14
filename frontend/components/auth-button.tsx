"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getToken, getUser, removeToken, fetchMe, type User } from "@/lib/auth"

export function AuthButton() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const token = getToken()
    if (!token) return
    // Show cached user immediately
    const cached = getUser()
    if (cached) setUser(cached)
    // Then refresh from server
    fetchMe().then(u => { if (u) setUser(u) })
  }, [])

  if (!mounted) return null

  if (!user) {
    return (
      <Link
        href="/login"
        className="btn-ghost-muted px-4 py-2 text-sm"
        style={{ borderRadius: 10, fontSize: 13 }}
      >
        Sign In
      </Link>
    )
  }

  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--surface2)", border: "1px solid var(--border-color)",
          borderRadius: 10, padding: "6px 12px", cursor: "pointer",
        }}
      >
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="avatar" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: 26, height: 26, borderRadius: "50%", background: "linear-gradient(135deg, var(--violet), var(--indigo))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "white" }}>
            {user.name?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        <span style={{ fontSize: 13, color: "var(--text-primary)", maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user.name || user.email.split("@")[0]}
        </span>
        <span style={{ color: "var(--text-muted)", fontSize: 10 }}>▼</span>
      </button>

      {open && (
        <div
          className="animate-slide-down"
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 200,
            background: "var(--surface)", border: "1px solid var(--border-color)",
            borderRadius: 14, padding: 8, minWidth: 180,
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
          onMouseLeave={() => setOpen(false)}
        >
          <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{user.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{user.email}</div>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", textDecoration: "none" }}
            className="hover:bg-[var(--surface2)]"
          >
            👤 Profile & Settings
          </Link>
          <button
            onClick={() => { removeToken(); setUser(null); setOpen(false); router.push("/login") }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, fontSize: 13, color: "var(--rose)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            className="hover:bg-[rgba(244,63,94,0.1)]"
          >
            🚪 Sign Out
          </button>
        </div>
      )}
    </div>
  )
}