"use client"
import { useState } from "react"
import type { Prediction } from "@/lib/types"

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""

export default function PredictionCard({
  prediction, index, subject, targetYear,
}: {
  prediction: Prediction
  index: number
  subject: string
  targetYear: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null)
  const [feedbackPending, setFeedbackPending] = useState(false)

  const prob = prediction.probability
  const tier = prob > 70 ? "high" : prob > 40 ? "mid" : "low"

  const probBadgeStyle = tier === "high"
    ? { background: "rgba(16,185,129,0.15)", color: "#10b981", border: "1px solid rgba(16,185,129,0.3)" }
    : tier === "mid"
    ? { background: "rgba(245,158,11,0.15)", color: "#f59e0b", border: "1px solid rgba(245,158,11,0.3)" }
    : { background: "rgba(244,63,94,0.15)", color: "#f43f5e", border: "1px solid rgba(244,63,94,0.3)" }

  const barBg = tier === "high"
    ? "linear-gradient(90deg, #10b981, #34d399)"
    : tier === "mid"
    ? "linear-gradient(90deg, #f59e0b, #fcd34d)"
    : "linear-gradient(90deg, #f43f5e, #fb7185)"

  const filledBars = Math.round(prob / 10)
  const confDotColor = tier === "high" ? "#10b981" : tier === "mid" ? "#f59e0b" : "#f43f5e"

  const handleFeedback = async (vote: 'up' | 'down') => {
    if (feedback || feedbackPending) return
    setFeedbackPending(true)
    try {
      await fetch(`${BACKEND}/api/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ predictionIndex: index, questionText: prediction.question_text, vote, subject, targetYear }),
      })
      setFeedback(vote)
    } catch { /* fail silently */ }
    finally { setFeedbackPending(false) }
  }

  return (
    <div className={`pred-card-base pred-${tier}`} style={{ animationDelay: `${index * 80}ms` }}>
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, letterSpacing: 1,
          background: "rgba(139,92,246,0.15)", color: "var(--violet-light)",
          border: "1px solid rgba(139,92,246,0.25)", padding: "3px 10px", borderRadius: 20,
        }}>#{String(index + 1).padStart(2, "0")}</span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, padding: "4px 12px", borderRadius: 20, ...probBadgeStyle }}>
          {prob}% likely
        </span>
      </div>

      <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.55, marginBottom: 14, color: "var(--text-primary)" }}>
        {prediction.question_text}
      </div>

      <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 5, overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 5, background: barBg, width: `${prob}%`, transition: "width 1.2s cubic-bezier(0.23,1,0.32,1)" }} />
      </div>

      <div className="flex gap-[3px] mt-2">
        {Array.from({ length: 10 }, (_, k) => (
          <div key={k} style={{ flex: 1, height: 3, borderRadius: 2, background: k < filledBars ? confDotColor : "rgba(255,255,255,0.06)" }} />
        ))}
      </div>

      <div className="flex items-center gap-3 mt-3">
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Helpful?</span>
        {(['up', 'down'] as const).map(vote => (
          <button
            key={vote}
            onClick={() => handleFeedback(vote)}
            disabled={feedbackPending || !!feedback}
            style={{
              opacity: feedback === vote ? 1 : 0.5,
              background: feedback === vote ? (vote === 'up' ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)') : 'transparent',
              border: `1px solid ${feedback === vote ? (vote === 'up' ? '#10b981' : '#f43f5e') : 'var(--border-color)'}`,
              borderRadius: 8, padding: '2px 8px', cursor: feedbackPending ? 'wait' : 'pointer', fontSize: 18, transition: 'all 0.2s',
            }}
          >
            {vote === 'up' ? '👍' : '👎'}
          </button>
        ))}
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12, fontSize: 12, fontWeight: 500, color: "var(--text-muted)", cursor: "pointer", border: "none", background: "none", fontFamily: "'Sora', sans-serif", padding: 0 }}
        className="hover:text-[var(--violet-light)]"
      >
        {expanded ? "▲ Hide details" : "▼ Show analysis & similar questions"}
      </button>

      {expanded && (
        <div className="animate-slide-down" style={{ marginTop: 14, padding: 16, background: "rgba(13,13,20,0.7)", border: "1px solid var(--border-color)", borderRadius: 12, fontSize: 13 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" }}>📌 AI Analysis</div>
            <div style={{ color: "var(--text-primary)", lineHeight: 1.6 }}>{prediction.explanation}</div>
          </div>

          {prediction.historical_years?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" }}>📅 Appeared in</div>
              <div className="flex flex-wrap gap-1">
                {prediction.historical_years.map(y => (
                  <span key={y} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, padding: "2px 8px", borderRadius: 6, background: "rgba(139,92,246,0.15)", color: "var(--violet-light)", border: "1px solid rgba(139,92,246,0.2)" }}>
                    {y}
                  </span>
                ))}
              </div>
            </div>
          )}

          {prediction.similar_questions?.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", letterSpacing: 0.5, marginBottom: 4, textTransform: "uppercase" }}>🔄 Similar Questions</div>
              {prediction.similar_questions.map((q, j) => (
                <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 6, color: "var(--text-muted)", marginTop: 4 }}>
                  <span style={{ color: "var(--violet-light)", marginTop: 1, flexShrink: 0 }}>›</span>{q}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}