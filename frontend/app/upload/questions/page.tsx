"use client"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

export default function UploadQuestions() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [subject, setSubject] = useState("")
  const [files, setFiles] = useState<File[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const progressRef = useRef<NodeJS.Timeout | null>(null)

  const years = Array.from({ length: new Date().getFullYear() - 1990 + 1 }, (_, i) => 1990 + i).reverse()

  useEffect(() => {
    if (loading) {
      setProgress(0)
      progressRef.current = setInterval(() => {
        setProgress(p => p >= 90 ? 90 : p + Math.random() * 15)
      }, 200)
    } else {
      if (progressRef.current) clearInterval(progressRef.current)
    }
    return () => { if (progressRef.current) clearInterval(progressRef.current) }
  }, [loading])

  const addFiles = (newFiles: File[]) => setFiles(prev => [...prev, ...newFiles])
  const removeFile = (i: number) => setFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    if (!subject.trim() || files.length === 0) return
    setLoading(true); setError(""); setSuccess(false)

    const formData = new FormData()
    formData.append("year", year.toString())
    formData.append("subject", subject.trim())
    files.forEach(f => formData.append("files", f))

    try {
      const res = await fetch(`${BACKEND}/api/upload/questions`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setProgress(100); setSuccess(true); setFiles([])
      toast.success(`${data.results.length} file(s) uploaded to Drive! ✅`)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }} className="hover:text-[var(--violet-light)]">← Back</Link>
        <div className="flex gap-2 mt-3 mb-5">
          <div className="nav-tabs-container">
            <span className="nav-tab active">📝 Questions</span>
            <Link href="/upload/resources" className="nav-tab">📚 Resources</Link>
          </div>
        </div>
        <h2 className="text-[26px] font-extrabold tracking-[-0.5px] mb-1" style={{ color: "var(--text-primary)" }}>Upload Past Questions</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Upload images or PDFs — stored in Google Drive, OCR runs during prediction.</p>
      </div>

      <div className="glass-card" style={{ padding: "28px" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Subject</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Physics" className="form-input-styled" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Exam Year</label>
            <select value={year} onChange={e => setYear(Number(e.target.value))} className="form-select-styled">
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        <div
          className={`drop-zone-base mb-4 ${dragging ? "drag-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)) }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" multiple accept="image/*,.pdf" className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = "" }}
            onClick={e => e.stopPropagation()} />
          <div style={{ fontSize: 36, marginBottom: 10 }}>{files.length > 0 ? "📁" : "☁️"}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4, color: "var(--text-primary)" }}>
            {files.length > 0 ? `${files.length} file(s) selected` : "Drop files or click to browse"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Supports JPG, PNG, PDF — max 600MB each (stored in Drive)</div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3" onClick={e => e.stopPropagation()}>
              {files.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, padding: "5px 10px", fontSize: 12, color: "var(--text-primary)" }}>
                  {f.type.includes("pdf") ? "📄" : "🖼️"} {f.name.length > 18 ? f.name.slice(0, 18) + "…" : f.name}
                  <span onClick={() => removeFile(i)} style={{ cursor: "pointer", color: "var(--text-muted)" }} className="hover:text-[var(--rose)]">✕</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {loading && (
          <div className="mb-4">
            <div className="flex justify-between mb-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <span>{progress < 50 ? "🔄 Uploading to Drive..." : "✨ Storing..."}</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{Math.round(progress)}%</span>
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 4, background: "linear-gradient(90deg, var(--violet), var(--pink))", width: `${progress}%`, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading || !subject.trim() || files.length === 0} className="btn-primary-glow w-full py-3 text-sm">
          {loading ? <><span className="inline-block animate-spin">⟳</span> Uploading...</> : "⬆️ Upload to Drive"}
        </button>

        {error && (
          <div style={{ marginTop: 14, padding: "14px 20px", borderRadius: 14, background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", color: "#fda4af", fontSize: 14 }}>❌ {error}</div>
        )}
        {success && (
          <div style={{ marginTop: 14, padding: "16px 20px", borderRadius: 14, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 22 }}>✅</span>
            <span style={{ fontSize: 13, color: "#6ee7b7" }}>
              Files uploaded to Google Drive! <Link href="/predict" style={{ color: "var(--violet-light)", fontWeight: 600 }}>Generate predictions →</Link>
            </span>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>💡 Tips</div>
        {["Upload from as many years as possible for better predictions", "Both English and Bengali text are supported", "Large books (400-500MB) are fully supported via Google Drive", "PDFs with selectable text are processed faster than scanned images"].map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--violet-light)", flexShrink: 0 }}>›</span>{tip}
          </div>
        ))}
      </div>
    </div>
  )
}