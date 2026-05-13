"use client"
import { useState, useRef } from "react"
import Link from "next/link"
import { toast } from "sonner"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

interface ResourceItem {
  name: string
  files: File[]
}

export default function UploadResources() {
  const [subject, setSubject] = useState("")
  const [resourceName, setResourceName] = useState("")
  const [queue, setQueue] = useState<ResourceItem[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [uploadedResults, setUploadedResults] = useState<{ name: string; files: string[] }[]>([])
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const totalFiles = queue.reduce((acc, q) => acc + q.files.length, 0)

  const addFiles = (newFiles: File[]) => {
    if (!resourceName.trim()) { toast.error("Please enter a resource name first"); return }
    setQueue(prev => {
      const existing = prev.find(q => q.name === resourceName.trim())
      if (existing) {
        return prev.map(q => q.name === resourceName.trim() ? { ...q, files: [...q.files, ...newFiles] } : q)
      }
      return [...prev, { name: resourceName.trim(), files: newFiles }]
    })
  }

  const removeFile = (name: string, idx: number) => {
    setQueue(prev =>
      prev.map(q => q.name === name ? { ...q, files: q.files.filter((_, i) => i !== idx) } : q)
          .filter(q => q.files.length > 0)
    )
  }

  const handleSubmit = async () => {
    if (queue.length === 0) return
    setLoading(true); setError(""); setUploadedResults([]); setProgress(0)
    const results: { name: string; files: string[] }[] = []
    let done = 0

    try {
      for (const item of queue) {
        const formData = new FormData()
        formData.append("subject", subject.trim())
        formData.append("name", item.name)
        item.files.forEach(f => formData.append("files", f))

        const res = await fetch(`${BACKEND}/api/upload/resources`, { method: "POST", body: formData })
        const data = await res.json()
        if (data.error) throw new Error(`"${item.name}": ${data.error}`)

        results.push({ name: item.name, files: item.files.map(f => f.name) })
        done += item.files.length
        setProgress(Math.round((done / totalFiles) * 100))
      }

      setUploadedResults(results)
      setQueue([])
      toast.success(`${done} resource file(s) uploaded! ✅`)
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
          <div className="nav-tabs-container" style={{ width: "auto" }}>
            <Link href="/upload/questions" className="nav-tab">📝 Questions</Link>
            <span className="nav-tab active">📚 Resources</span>
          </div>
        </div>
        <h2 className="text-[26px] font-extrabold tracking-[-0.5px] mb-1" style={{ color: "var(--text-primary)" }}>Upload Study Resources</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Add textbooks or notes — name each resource, add files, upload all at once.</p>
      </div>

      <div className="glass-card" style={{ padding: "28px" }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Subject (optional)</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g., Chemistry" className="form-input-styled" />
          </div>
          <div className="flex flex-col gap-2">
            <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", color: "var(--text-muted)" }}>Resource Name</label>
            <input type="text" value={resourceName} onChange={e => setResourceName(e.target.value)} placeholder="e.g., Hossain Sir's Notes" className="form-input-styled" />
          </div>
        </div>

        <div
          className={`drop-zone-base mb-5 ${dragging ? "drag-over" : ""}`}
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); addFiles(Array.from(e.dataTransfer.files)) }}
          onClick={() => resourceName.trim() ? inputRef.current?.click() : toast.error("Enter resource name first")}
        >
          <input ref={inputRef} type="file" multiple accept="image/*,.pdf" className="hidden"
            onChange={e => { if (e.target.files?.length) addFiles(Array.from(e.target.files)); e.target.value = "" }}
            onClick={e => e.stopPropagation()} />
          <div style={{ fontSize: 36, marginBottom: 8 }}>📚</div>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4, color: "var(--text-primary)" }}>
            {resourceName.trim()
              ? <>Add files for "<span style={{ color: "var(--violet-light)" }}>{resourceName}</span>"</>
              : "Enter resource name above first"
            }
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>PDF, JPG, PNG — up to 600MB per file</div>
        </div>

        {/* Queue display */}
        {queue.length > 0 && (
          <div className="mb-5 animate-slide-down">
            <div className="flex items-center justify-between mb-3">
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>
                Queued ({totalFiles} files)
              </span>
              <button onClick={() => setQueue([])} style={{ fontSize: 11, color: "var(--rose)", background: "none", border: "none", cursor: "pointer" }}>Clear all</button>
            </div>
            {queue.map(item => (
              <div key={item.name} style={{ marginBottom: 10, padding: "14px 16px", borderRadius: 14, background: "var(--surface2)", border: "1px solid var(--border-color)" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--violet-light)", marginBottom: 8 }}>📚 {item.name}</div>
                <div className="flex flex-wrap gap-2">
                  {item.files.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "var(--text-primary)" }}>
                      {f.type.includes("pdf") || f.name.endsWith(".pdf") ? "📄" : "🖼️"}
                      {f.name.length > 20 ? f.name.slice(0, 20) + "…" : f.name}
                      <span onClick={() => removeFile(item.name, i)} style={{ cursor: "pointer", color: "var(--text-muted)" }} className="hover:text-[var(--rose)]">✕</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {loading && (
          <div className="mb-4">
            <div className="flex justify-between mb-1" style={{ fontSize: 12, color: "var(--text-muted)" }}>
              <span>🔄 Uploading to Google Drive...</span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{progress}%</span>
            </div>
            <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", borderRadius: 5, background: "linear-gradient(90deg, var(--violet), var(--pink))", width: `${progress}%`, transition: "width 0.5s ease" }} />
            </div>
          </div>
        )}

        <button onClick={handleSubmit} disabled={loading || queue.length === 0} className="btn-primary-glow w-full py-3 text-sm">
          {loading
            ? <><span className="inline-block animate-spin">⟳</span> Uploading...</>
            : `⬆️ Upload All (${totalFiles} file${totalFiles !== 1 ? "s" : ""})`
          }
        </button>

        {error && <div style={{ marginTop: 14, padding: "14px 20px", borderRadius: 14, background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.3)", color: "#fda4af", fontSize: 14 }}>❌ {error}</div>}

        {uploadedResults.length > 0 && (
          <div className="animate-slide-down" style={{ marginTop: 16, padding: "14px 16px", borderRadius: 14, background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)" }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#6ee7b7", marginBottom: 10 }}>✅ Upload Complete!</div>
            {uploadedResults.map(r => (
              <div key={r.name} style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--violet-light)", marginBottom: 4 }}>📚 {r.name}</div>
                <div className="flex flex-wrap gap-1.5">
                  {r.files.map((name, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(16,185,129,0.1)", color: "#6ee7b7", border: "1px solid rgba(16,185,129,0.2)" }}>
                      ✓ {name.length > 20 ? name.slice(0, 20) + "…" : name}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}