import Link from "next/link"
import { AnimatedCounter } from "@/components/animated-counter"

// Fetch stats from backend
async function getStats() {
  try {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""
    const res = await fetch(`${BACKEND}/api/stats`, { next: { revalidate: 60 } })
    if (!res.ok) return { subjects: 0, questions: 0 }
    return await res.json()
  } catch {
    return { subjects: 0, questions: 0 }
  }
}

export default async function Home() {
  const stats = await getStats()

  return (
    <div className="flex flex-col gap-12">
      {/* Hero */}
      <section className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-7" style={{
          fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase",
          color: "var(--violet-light)", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)",
        }}>
          ⚡ AI-Powered Exam Intelligence
        </div>

        <h1 className="font-extrabold leading-[1.05] tracking-[-2px] mb-5" style={{ fontSize: "clamp(36px, 6vw, 68px)" }}>
          Predict your<br />
          <span className="gradient-text">next exam questions</span>
        </h1>

        <p className="text-lg max-w-[500px] mx-auto mb-10 leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Upload past papers & textbooks. Let AI detect patterns and forecast what&apos;s coming — before you walk into the exam hall.
        </p>

        <div className="flex justify-center gap-10 mb-10 flex-wrap">
          {[
            { value: stats.subjects, suffix: "+", label: "Subjects" },
            { value: stats.questions, suffix: "+", label: "Questions Analyzed", animated: true },
            { value: 12, suffix: "+", label: "Years Coverage" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-[32px] font-extrabold" style={{
                background: "linear-gradient(135deg, var(--violet-light), var(--pink))",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              }}>
                {s.animated ? <AnimatedCounter value={s.value} /> : s.value}{s.suffix}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500, letterSpacing: 0.5, marginTop: 2 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-3 justify-center flex-wrap">
          <Link href="/predict" className="btn-primary-glow px-8 py-3.5 text-sm no-underline">
            🔮 Try Predictions
          </Link>
          <Link href="/upload/questions" className="btn-ghost-muted px-8 py-3.5 text-sm no-underline inline-flex items-center gap-2">
            📤 Upload Papers
          </Link>
          <Link href="/subjects" className="btn-ghost-muted px-8 py-3.5 text-sm no-underline inline-flex items-center gap-2">
            📊 Browse Subjects
          </Link>
        </div>
      </section>

      {/* Feature cards */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { href: "/upload/questions", icon: "📝", title: "Upload Questions", desc: "Scan past exam papers. AI-powered OCR supports English & Bengali text.", iconBg: "rgba(99,102,241,0.15)", iconBorder: "rgba(99,102,241,0.3)" },
          { href: "/upload/resources", icon: "📚", title: "Upload Resources", desc: "Add textbooks, notes as PDF — up to 600MB, stored securely in Google Drive.", iconBg: "rgba(139,92,246,0.15)", iconBorder: "rgba(139,92,246,0.3)" },
          { href: "/predict", icon: "🔮", title: "Get Predictions", desc: "AI detects patterns and forecasts probable questions with confidence scores.", iconBg: "rgba(236,72,153,0.15)", iconBorder: "rgba(236,72,153,0.3)" },
        ].map(card => (
          <Link key={card.title} href={card.href} className="glass-card group relative overflow-hidden text-left no-underline block">
            <div style={{ width: 48, height: 48, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 16, background: card.iconBg, border: `1px solid ${card.iconBorder}` }}>
              {card.icon}
            </div>
            <h3 style={{ fontSize: 17, fontWeight: 700, marginBottom: 8, color: "var(--text-primary)" }}>{card.title}</h3>
            <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{card.desc}</p>
            <span style={{ position: "absolute", top: 20, right: 20, color: "var(--text-muted)", fontSize: 18, transition: "transform 0.2s, color 0.2s" }} className="group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:text-[var(--violet-light)]">↗</span>
          </Link>
        ))}
      </section>

      {/* How it works */}
      <section className="glass-card" style={{ padding: "28px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 20 }}>How it works</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            { step: "01", icon: "📥", title: "Upload Papers", desc: "Drag & drop past exam papers. Files stored in Google Drive." },
            { step: "02", icon: "🧠", title: "AI Analysis", desc: "OCR extracts text, LLM analyzes question patterns across years." },
            { step: "03", icon: "🔮", title: "Get Forecast", desc: "Ranked predictions with probability scores and real-time ETA." },
            { step: "04", icon: "📖", title: "Study Smart", desc: "Focus your revision on high-probability topics and question types." },
          ].map(item => (
            <div key={item.step} className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "var(--violet)", fontWeight: 700, background: "rgba(139,92,246,0.1)", padding: "2px 8px", borderRadius: 6 }}>{item.step}</span>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--text-primary)" }}>{item.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}