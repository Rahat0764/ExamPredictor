"use client"
import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { getToken, getUser, removeToken, fetchMe, type User } from "@/lib/auth"

export function AuthButton() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    const token = getToken()
    if (!token) return
    const cached = getUser()
    if (cached) setUser(cached)
    fetchMe().then(u => { if (u) setUser(u) })
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!mounted) return null

  if (!user) {
    return (
      <Link
        href="/login"
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "linear-gradient(135deg, var(--violet), var(--indigo))",
          color: "white", borderRadius: 10, padding: "7px 14px",
          fontSize: 13, fontWeight: 600, textDecoration: "none",
          boxShadow: "0 4px 15px rgba(139,92,246,0.3)",
        }}
      >
        Sign In
      </Link>
    )
  }

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          background: "var(--surface2)", border: "1px solid var(--border-color)",
          borderRadius: 10, padding: "5px 10px 5px 5px", cursor: "pointer",
          maxWidth: 180,
        }}
        title={user.name || user.email}
      >
        {/* Avatar */}
        {user.avatar_url ? (
          <img
            src={user.avatar_url}
            alt={user.name || "avatar"}
            style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, var(--violet), var(--indigo))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "white",
          }}>
            {(user.name || user.email)?.[0]?.toUpperCase() || "U"}
          </div>
        )}
        {/* Name — hidden on very small screens */}
        <span style={{
          fontSize: 13, color: "var(--text-primary)", fontWeight: 500,
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          display: "none",
        }} className="sm:block" suppressHydrationWarning>
          {user.name?.split(' ')[0] || user.email.split('@')[0]}
        </span>
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
          <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="animate-slide-down"
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 300,
            background: "var(--surface)", border: "1px solid var(--border-color)",
            borderRadius: 14, padding: 8, minWidth: 200,
            boxShadow: "0 12px 40px rgba(0,0,0,0.4)",
          }}
        >
          {/* User info */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border-color)", marginBottom: 6 }}>
            <div className="flex items-center gap-3">
              {user.avatar_url ? (
                <img src={user.avatar_url} alt="" style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover" }} />
              ) : (
                <div style={{ width: 38, height: 38, borderRadius: "50%", background: "linear-gradient(135deg, var(--violet), var(--indigo))", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "white" }}>
                  {(user.name || user.email)?.[0]?.toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{user.name || "User"}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 140 }}>{user.email}</div>
              </div>
            </div>
          </div>

          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "var(--text-primary)", textDecoration: "none" }}
            className="hover:bg-[var(--surface2)]"
          >
            <span>👤</span> Profile & Settings
          </Link>

          <div style={{ borderTop: "1px solid var(--border-color)", margin: "6px 0" }} />

          <button
            onClick={() => {
              removeToken()
              setUser(null)
              setOpen(false)
              router.push("/login")
            }}
            style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 8, fontSize: 13, color: "var(--rose)", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
            className="hover:bg-[rgba(244,63,94,0.1)]"
          >
            <span>🚪</span> Sign Out
          </button>
        </div>
      )}
    </div>
  )
}