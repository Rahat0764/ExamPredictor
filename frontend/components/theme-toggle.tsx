"use client"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

export function ThemeToggle() {
  const { setTheme, theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return (
    <button style={{
      width: 36, height: 36, borderRadius: 10,
      background: "transparent",
      border: "1px solid var(--border-color)",
      cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
    }} aria-label="Toggle theme" />
  )

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      aria-label="Toggle theme"
      style={{
        width: 36, height: 36, borderRadius: 10,
        background: "transparent",
        border: "1px solid var(--border-color)",
        cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: "var(--text-muted)",
        transition: "all 0.2s",
      }}
      className="hover:border-[var(--border-hover)] hover:text-[var(--text-primary)]"
    >
      {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}