"use client"
import { useState, useEffect, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import PredictionCard from "@/components/prediction-card"
import { savePredictionToHistory, getPredictionHistory } from "@/lib/localStore"
import { exportPredictionsAsPDF } from "@/lib/export"
import type { Prediction } from "@/lib/types"
import Link from "next/link"
import { toast } from "sonner"
import { getToken, authHeaders } from "@/lib/auth"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""
const QUICK_SUBJECTS = ["Physics", "Chemistry", "Mathematics", "Biology", "Bangla", "English", "History", "ICT"]

type ProgressState = {
  stage: string
  current: number
  total: number
  message: string
  eta: number | null
}

function ProgressBar({ progress, loading }: { progress: ProgressState | null; loading: boolean }) {
  if (!loading || !progress) return null
  const pct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0

  const stageLabel: Record<string, string> = {
    ocr: "📄 OCR Processing",
    ocr_resources: "📚 Resource OCR",
    ai: "🧠 AI Prediction",
    queued: "⏳ Queued",
  }

  return (
    <div style={{ marginBottom: 20, padding: "20px 24px", background: "var(--surface)", border: "1px solid var(--border-color)", borderRadius: 16 }}>
      <div className="flex justify-between items-center mb-2">
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--violet-light)" }}>{stageLabel[progress.stage] || "⏳ Processing"}</span>
        <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", color: "var(--text-muted)" }}>
          {progress.total > 0 ? `${pct}%` : ""}
          {progress.eta ? ` · ~${progress.eta}s left` : ""}
        </span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 6, overflow: "hidden", marginBottom: 10 }}>
        <div style={{
          height: "100%", borderRadius: 6,
          background: "linear-gradient(90deg, var(--violet), var(--pink))",
          width: progress.total > 0 ? `${pct}%` : "100%",
          transition: "width 0.6s ease",
        }} />
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", margin: 0 }}>{progress.message}</p>
      {progress.stage === "ocr" && progress.total > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {Array.from({ length: Math.min(progress.total, 30) }, (_, i) => (
            <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: i < progress.current ? "var(--emerald)" : "rgba(255,255,255,0.1)", transition: "background 0.3s" }} />
          ))}
        </div>
      )}
    </div>
  )
}

function PredictContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [subject, setSubject] = useState(searchParams.get("subject") || "Physics")
  const [targetYear, setTargetYear] = useState(Number(searchParams.get("year")) || new Date().getFullYear() + 1)
  const [predictions, setPredictions] = useState<Prediction[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [history, setHistory] = useState<ReturnType<typeof getPredictionHistory>>([])
  const [progress, setProgress] = useState<ProgressState | null>(null)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const sseRef = useRef<EventSource | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  const years = Array.from({ length: new Date().getFullYear() - 1990 + 3 }, (_, i) => 1990 + i).reverse()

  useEffect(() => {
    const token = getToken()
    setIsLoggedIn(!!token)
    setHistory(getPredictionHistory())

    if (token) {
      const savedJob = localStorage.getItem("pending_job")
      if (savedJob) {
        try {
          const { jobId: jId, subject: s, year: y } = JSON.parse(savedJob)
          setSubject(s); setTargetYear(y)
          setLoading(true)
          connectSSE(jId, s, y)
        } catch (e) {
          localStorage.removeItem("pending_job")
        }
      }
    }

    return () => {
      if (sseRef.current) sseRef.current.close()
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  useEffect(() => {
    const params = new URLSearchParams()
    params.set("subject", subject.trim())
    params.set("year", targetYear.toString())
    router.replace(`/predict?${params.toString()}`, { scroll: false })
  }, [subject, targetYear, router])

  function connectSSE(jId: string, subj: string, yr: number) {
    if (sseRef.current) sseRef.current.close()
    const es = new EventSource(`${BACKEND}/api/predict/progress/${jId}`)
    sseRef.current = es

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === "progress") {
        setProgress({ stage: data.stage, current: data.current, total: data.total, message: data.message, eta: data.eta })
      } else if (data.type === "complete") {
        setPredictions(data.predictions)
        setLoading(false); setProgress(null)
        savePredictionToHistory(subj, yr)
        setHistory(getPredictionHistory())
        localStorage.removeItem("pending_job")
        es.close()
        toast.success(`${data.predictions.length} predictions ready! 🎯`)
      } else if (data.type === "cancelled") {
        setLoading(false); setProgress(null)
        setError(`Cancelled${data.reason ? `: ${data.reason}` : ""}`)
        localStorage.removeItem("pending_job")
        es.close()
        toast.error("Request cancelled by admin")
      } else if (data.type === "error") {
        setLoading(false); setProgress(null)
        setError(data.message || "Prediction failed")
        localStorage.removeItem("pending_job")
        es.close()
      }
    }

    es.onerror = () => {
      es.close()
      // Fallback polling
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${BACKEND}/api/predict/status/${jId}`)
          const data = await res.json()
          if (data.status === "completed" && data.result) {
            clearInterval(intervalRef.current!)
            setPredictions(data.result.predictions)
            setLoading(false); setProgress(null)
            savePredictionToHistory(subj, yr)
            setHistory(getPredictionHistory())
            localStorage.removeItem("pending_job")
            toast.success("Predictions ready! 🎯")
          } else if (data.status === "cancelled") {
            clearInterval(intervalRef.current!)
            setLoading(false)
            setError(`Cancelled: ${data.cancelReason || "By admin"}`)
            localStorage.removeItem("pending_job")
          } else if (data.status === "failed") {
            clearInterval(intervalRef.current!)
            setLoading(false)
            setError("Prediction failed")
            localStorage.removeItem("pending_job")
          } else if (data.message) {
            setProgress({ stage: data.stage, current: data.current, total: data.total, message: data.message, eta: null })
          }
        } catch (e) { /* keep polling */ }
      }, 3000)
    }
  }

  const handlePredict = async () => {
    if (!isLoggedIn) { router.push("/login"); return }
    if (!subject.trim()) return

    setLoading(true); setError(""); setPredictions([])
    setProgress({ stage: "queued", current: 0, total: 0, message: "Starting prediction job...", eta: null })

    try {
      const res = await fetch(`${BACKEND}/api/predict/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ subject: subject.trim(), targetYear }),
      })
      const data = await res.json()
      if (data.error) {
        if (res.status === 401) { router.push("/login"); return }
        setError(data.error); setLoading(false); return
      }
      const jId = data.jobId
      localStorage.setItem("pending_job", JSON.stringify({ jobId: jId, subject: subject.trim(), year: targetYear }))
      connectSSE(jId, subject.trim(), targetYear)
    } catch (e: any) {
      setError(e.message); setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }} className="hover:text-[var(--violet-light)]">← Back</Link>
        <h1 className="text-[28px] font-extrabold tracking-[-0.5px] mt-3 mb-1" style={{ color: "var(--text-primary)" }}>🔮 AI Exam Forecast</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Select subject & year — AI analyzes historical patterns to predict likely questions.</p>
      </div>

      {/* Auth notice */}
      {!isLoggedIn && (
        <div style={{ padding: "16px 20px", borderRadius: 14, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, color: "var(--violet-light)" }}>🔐 Sign in to generate predictions</span>
          <Link href="/login" className="btn-primary-glow px-4 py-2 text-xs no-underline">Sign In</Link>
        </div>
      )}

      <div className="glass-card" style={{ padding: "28px" }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 8 }}>Quick Select</div>
        <div className="flex flex-wrap gap-2 mb-5">
          {QUICK_SUBJECTS.map(s => (
            <button key={s} onClick={() => setSubject(s)} className={`subject-chip ${subject === s ? "active" : ""}`}>{s}</button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_180px] gap-4 mb-5">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Physics, Bangla" className="form-input-styled" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Target Year</label>
            <select value={targetYear} onChange={e => setTargetYear(Number(e.target.value))} className="form-select-styled">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <button
          onClick={handlePredict}
          disabled={loading || !subject.trim()}
          className="btn-primary-glow w-full py-3 text-sm"
        >
          {loading
            ? <><span className="inline-block animate-spin">⟳</span> Processing...</>
            : isLoggedIn ? "✨ Generate Predictions" : "🔐 Sign in to Predict"
          }
        </button>

        {error && (
          <div style={{ marginTop: 14, padding: "14px 20px", borderRadius: 14, background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", color: "#fda4af", fontSize: 14, display: "flex", alignItems: "center", gap: 10 }}>
            ❌ {error}
          </div>
        )}

        {history.length > 0 && !loading && predictions.length === 0 && isLoggedIn && (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>📌 Recent</div>
            <div className="flex flex-wrap gap-2">
              {history.slice(0, 5).map((h, i) => (
                <button key={i} onClick={() => { setSubject(h.subject); setTargetYear(h.year) }} className="subject-chip">
                  {h.subject} ({h.year})
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <ProgressBar progress={progress} loading={loading} />

      {loading && !progress?.stage.startsWith("ai") && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="pred-card-base" style={{ padding: 22 }}>
              <div className="flex justify-between mb-3">
                <div className="skeleton-shimmer" style={{ width: 70, height: 22 }} />
                <div className="skeleton-shimmer" style={{ width: 80, height: 22 }} />
              </div>
              <div className="skeleton-shimmer" style={{ width: "80%", height: 16, marginBottom: 8 }} />
              <div className="skeleton-shimmer" style={{ width: "55%", height: 16, marginBottom: 14 }} />
              <div className="skeleton-shimmer" style={{ height: 5, borderRadius: 5 }} />
            </div>
          ))}
        </div>
      )}

      {!loading && predictions.length > 0 && (
        <div>
          <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
            <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{predictions.length}</span> predictions for{" "}
              <span style={{ color: "var(--violet-light)", fontWeight: 600 }}>{subject} {targetYear}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/predict?subject=${encodeURIComponent(subject)}&year=${targetYear}`); toast.success("Link copied!") }} className="btn-ghost-muted px-3 py-1.5 text-xs">🔗 Share</button>
              <button onClick={() => exportPredictionsAsPDF(subject, targetYear, "predictions-container")} className="btn-ghost-muted px-3 py-1.5 text-xs">📥 PDF</button>
              <button onClick={() => setPredictions([])} className="btn-ghost-muted px-3 py-1.5 text-xs">Clear</button>
            </div>
          </div>
          <div id="predictions-container" className="space-y-3">
            {predictions.map((p, i) => (
              <PredictionCard key={i} prediction={p} index={i} subject={subject} targetYear={targetYear} />
            ))}
          </div>
        </div>
      )}

      {!loading && !error && predictions.length === 0 && !progress && (
        <div className="text-center py-20">
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔮</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Ready to predict</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            {isLoggedIn
              ? <>Select a subject and click Generate. Or browse <Link href="/subjects" style={{ color: "var(--violet-light)" }}>subjects</Link>.</>
              : <><Link href="/login" style={{ color: "var(--violet-light)" }}>Sign in</Link> to generate AI predictions.</>
            }
          </div>
        </div>
      )}
    </div>
  )
}

export default function PredictPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20" style={{ color: "var(--text-muted)" }}>Loading...</div>}>
      <PredictContent />
    </Suspense>
  )
}