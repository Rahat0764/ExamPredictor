"use client"
import { useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import { Toaster } from "sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { ThemeToggle } from "@/components/theme-toggle"
import Link from "next/link"
import "./globals.css"

function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")!
    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      dx: (Math.random() - 0.5) * 0.3,
      dy: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
    }))
    let raf: number
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139,92,246,${p.opacity})`
        ctx.fill()
        p.x += p.dx; p.y += p.dy
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1
      })
      particles.forEach((p, i) => {
        particles.slice(i + 1).forEach(q => {
          const d = Math.hypot(p.x - q.x, p.y - q.y)
          if (d < 90) {
            ctx.beginPath()
            ctx.strokeStyle = `rgba(139,92,246,${0.05 * (1 - d / 90)})`
            ctx.lineWidth = 0.5
            ctx.moveTo(p.x, p.y)
            ctx.lineTo(q.x, q.y)
            ctx.stroke()
          }
        })
      })
      raf = requestAnimationFrame(draw)
    }
    draw()
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    window.addEventListener("resize", resize)
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize) }
  }, [])
  return <canvas ref={canvasRef} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.6 }} />
}

function NavTabs({ currentPath }: { currentPath: string }) {
  const tabs = [
    { id: "home", icon: "🏠", label: "Home", href: "/" },
    { id: "upload", icon: "📤", label: "Upload", href: "/upload/questions" },
    { id: "predict", icon: "🔮", label: "Predict", href: "/predict" },
    { id: "subjects", icon: "📊", label: "Subjects", href: "/subjects" },
  ]
  const isActive = (tab: typeof tabs[0]) => {
    if (tab.id === "home") return currentPath === "/"
    if (tab.id === "upload") return currentPath.startsWith("/upload")
    return currentPath.startsWith(`/${tab.id}`)
  }
  return (
    <div className="nav-tabs-container">
      {tabs.map(tab => (
        <Link
          key={tab.id}
          href={tab.href}
          className={`nav-tab flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-[6px] flex-1 sm:flex-none !px-1 sm:!px-[18px] !py-2 sm:!py-[7px] ${isActive(tab) ? "active" : ""}`}
        >
          <span>{tab.icon}</span>
          <span>{tab.label}</span>
        </Link>
      ))}
    </div>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>ExamPredictor — AI Exam Intelligence</title>
        <meta name="description" content="Upload past papers. AI predicts your next exam questions." />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#8b5cf6" />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <ParticleField />

          {/* HEADER — theme-aware */}
          <header style={{
            position: "sticky",
            top: 0,
            zIndex: 100,
            borderBottom: "1px solid var(--border-color)",
            background: "var(--header-bg)",
            backdropFilter: "blur(20px)",
            height: 60,
          }}>
            <div className="max-w-6xl mx-auto flex items-center justify-between h-full px-6">
              <Link href="/" className="flex items-center gap-2 no-underline">
                <span className="text-[20px] font-extrabold tracking-[-0.5px] gradient-text">
                  ExamPredictor
                </span>
                <span style={{
                  display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                  background: "var(--violet)", animation: "livePulse 2s infinite",
                }} />
              </Link>
              <div className="hidden sm:flex items-center gap-3">
                <NavTabs currentPath={pathname} />
                <ThemeToggle />
                <span className="badge-live">AI LIVE</span>
              </div>
              <div className="flex items-center gap-3 sm:hidden">
                <ThemeToggle />
                <span className="badge-live">AI LIVE</span>
              </div>
            </div>
          </header>

          <div className="sm:hidden flex w-full px-4 py-3">
            <NavTabs currentPath={pathname} />
          </div>

          <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-20">
            {children}
          </main>

          <footer style={{ borderTop: "1px solid var(--border-color)", padding: "32px 24px", background: "var(--surface)", position: "relative", zIndex: 10 }}>
            <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4" style={{ fontSize: 13, color: "var(--text-muted)" }}>
              <div>
                Developed by{" "}
                <a href="https://linkedin.com/in/RahatAhmedX" target="_blank" rel="noopener noreferrer"
                  style={{ color: "var(--violet-light)", textDecoration: "underline dotted", textUnderlineOffset: 2 }}>
                  Rahat
                </a>
              </div>
              <a href="https://github.com/Rahat0764/ExamPredictor" target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--text-muted)" }} className="hover:text-[var(--violet-light)] transition-colors flex items-center gap-1">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.73.083-.73 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12 24 5.37 18.63 0 12 0Z" />
                </svg>
                GitHub
              </a>
            </div>
          </footer>

          <Toaster position="top-center" richColors />
        </ThemeProvider>
      </body>
    </html>
  )
}