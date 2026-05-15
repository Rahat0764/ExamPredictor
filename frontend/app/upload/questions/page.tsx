"use client"
import { useState, useRef, useEffect } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useRouter } from "next/navigation"
import { getToken, authHeaders } from "@/lib/auth"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

interface BatchItem {
  year: number
  files: File[]
}

const currentYear = new Date().getFullYear()
const years = Array.from({ length: currentYear - 1989 }, (_, i) => currentYear - i)

export default function UploadQuestions() {
  const router = useRouter()
  const [subject, setSubject] = useState("")
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [batches, setBatches] = useState<BatchItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedResults, setUploadedResults] = useState<{ year: number; files: string[] }[]>([])
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  // Auth Guard: Not logged in? Go to login page
  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.push("/login")
    }
  }, [router])

  const totalFiles = batches.reduce((acc, b) => acc + b.files.length, 0)

  const addFiles = (newFiles: File[]) => {
    setBatches(prev => {
      const existing = prev.find(b => b.year === selectedYear)
      if (existing) {
        return prev.map(b => b.year === selectedYear ? { ...b, files: [...b.files, ...newFiles] } : b)
      }
      return [...prev, { year: selectedYear, files: newFiles }].sort((a, b) => b.year - a.year)
    })
  }

  const removeFile = (year: number, idx: number) => {
    setBatches(prev =>
      prev.map(b => b.year === year ? { ...b, files: b.files.filter((_, i) => i !== idx) } : b)
          .filter(b => b.files.length > 0)
    )
  }

  const removeBatch = (year: number) => {
    setBatches(prev => prev.filter(b => b.year !== year))
  }

  const handleSubmit = async () => {
    if (!subject.trim() || batches.length === 0) return
    setLoading(true); setError(""); setUploadedResults([]); setProgress(0)

    const results: { year: number; files: string[] }[] = []
    let done = 0

    try {
      for (const batch of batches) {
        const formData = new FormData()
        formData.append("year", batch.year.toString())
        formData.append("subject", subject.trim())
        batch.files.forEach(f => formData.append("files", f))

        const res = await fetch(`${BACKEND}/api/upload/questions`, { 
          method: "POST", 
          headers: authHeaders(), // Added headers for authentication
          body: formData 
        })
        const data = await res.json()
        if (data.error) throw new Error(`Year ${batch.year}: ${data.error}`)

        results.push({ year: batch.year, files: batch.files.map(f => f.name) })
        done += batch.files.length
        setProgress(Math.round((done / totalFiles) * 100))
      }

      setUploadedResults(results)
      setBatches([])
      toast.success(`${done} file(s) uploaded to Google Drive! ✅`)
    } catch (e: any) {
      setError(e.message)
      toast.error(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto">
      <div>
        <Link href="/" style={{ fontSize: 13, color: "var(--text-muted)", textDecoration: "none" }} className="hover:text-[var(--violet-light)]">← Back</Link>
        <div className="flex gap-2 mt-3 mb-5">
          <div className="nav-tabs-container" style={{ width: "auto" }}>
            <span className="nav-tab active">📝 Questions</span>
            <Link href="/upload/resources" className="nav-tab">📚 Resources</Link>
          </div>
        </div>
        <h2 className="text-[26px] font-extrabold tracking-[-0.5px] mb-1" style={{ color: "var(--text-primary)" }}>Upload Past Questions</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Select year → add files → change year → add more → Upload All at once.</p>
      </div>

      <div className="glass-card" style={{ padding: "28px" }}>
        {/* Subject */}
        <div className="flex flex-col gap-2 mb-4">
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Subject</label>
          <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Physics, Chemistry" className="form-input-styled" />
        </div>

        {/* Year selector */}
        <div className="flex flex-col gap-2 mb-4">
          <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Select Year to Add Files</label>
          <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="form-select-styled">
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Drop zone */}
        <div
          className={`drop-zone-base mb-5 ${dragging ? "drag-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)) }}
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" multiple accept="image/*,.pdf" className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = "" }}
            onClick={e => e.stopPropagation()} />
          <div style={{ fontSize: 36, marginBottom: 8 }}>📁</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
            Click or drag files for <span style={{ color: "var(--violet-light)" }}>{selectedYear}</span>
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Supports PDF, JPG, PNG (Max 600MB/file)</div>
        </div>

        {/* Queued batches */}
        {batches.length > 0 && (
          <div className="mb-5 animate-slide-down">
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                Queued for Upload ({totalFiles} files)
              </span>
              <button onClick={() => setBatches([])} style={{ fontSize: 11, color: "var(--rose)", background: "none", border: "none", cursor: "pointer" }}>
                Clear all
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {batches.map(batch => (
                <div key={batch.year} style={{ padding: "14px 16px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border-color)" }}>
                  <div className="flex items-center justify-between mb-2">
                    <span style={{ fontSize: 13, fontWeight: 700, color: "var(--violet-light)" }}>
                      Year: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{batch.year}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{batch.files.length} files</span>
                      <button onClick={() => removeBatch(batch.year)} style={{ fontSize: 11, color: "var(--rose)", background: "none", border: "none", cursor: "pointer" }}>✕ Remove</button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {batch.files.map((f, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "var(--text-primary)" }}>
                        {f.type.includes("pdf") || f.name.endsWith(".pdf") ? "📄" : "🖼️"}
                        {f.name.length > 20 ? f.name.slice(0, 20) + "…" : f.name}
                        <span onClick={() => removeFile(batch.year, i)} style={{ cursor: "pointer", color: "var(--text-muted)", marginLeft: 2 }} className="hover:text-[var(--rose)]">✕</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Progress bar */}
        {loading && (
          <div className="mb-4">
            <div className="flex justify-between mb-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <span>🔄 Uploading batch {Math.ceil(progress / (100 / batches.length))} of {batches.length}...</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{progress}%</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 5, background: "linear-gradient(90deg, var(--violet), var(--pink))", width: `${progress}%`, transition: "width 0.4s ease" }} />
            </div>
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !subject.trim() || batches.length === 0}
          className="btn-primary-glow w-full py-3 text-sm"
        >
          {loading
            ? <><span className="inline-block animate-spin">⟳</span> Uploading...</>
            : `⬆️ Upload All (${totalFiles} file${totalFiles !== 1 ? "s" : ""})`
          }
        </button>

        {error && <div style={{ marginTop: 14, padding: "14px 20px", borderRadius: 14, background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", color: "#fda4af", fontSize: 14 }}>❌ {error}</div>}

        {/* Upload success results */}
        {uploadedResults.length > 0 && (
          <div className="animate-slide-down" style={{ marginTop: 16 }}>
            <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#6ee7b7", marginBottom: 10 }}>✅ Upload Complete!</div>
              {uploadedResults.sort((a, b) => b.year - a.year).map(r => (
                <div key={r.year} style={{ marginBottom: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--violet-light)", marginBottom: 4 }}>
                    📅 {r.year} — {r.files.length} file(s)
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.files.map((name, i) => (
                      <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
                        ✓ {name.length > 20 ? name.slice(0, 20) + "…" : name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <Link href="/predict" style={{ display: "inline-flex", alignItems: "center", gap: 4, marginTop: 8, fontSize: 13, color: "var(--violet-light)", fontWeight: 600, textDecoration: "none" }}>
                🔮 Generate predictions →
              </Link>
            </div>
          </div>
        )}
      </div>

      <div className="glass-card" style={{ padding: "20px 24px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>💡 Tips</div>
        {[
          "Select a year, add files, then switch year and add more — upload all at once",
          "Upload from as many years as possible for better AI predictions",
          "Both English and Bengali text are fully supported",
          "Large PDFs (400-500MB) are supported via Google Drive",
        ].map((tip, i) => (
          <div key={i} style={{ display: "flex", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            <span style={{ color: "var(--violet-light)", flexShrink: 0 }}>›</span>{tip}
          </div>
        ))}
      </div>
    </div>
  )
}
