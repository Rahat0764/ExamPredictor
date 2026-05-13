async function getSubjects() {
  try {
    const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ""
    const res = await fetch(`${BACKEND}/api/subjects`, { next: { revalidate: 30 } })
    if (!res.ok) return []
    return await res.json()
  } catch {
    return []
  }
}

import Link from "next/link"

export default async function SubjectsPage() {
  const subjects = await getSubjects()

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.5px] mb-1" style={{ color: "var(--text-primary)" }}>📊 Subject Coverage</h1>
        <p style={{ fontSize: 14, color: "var(--text-muted)" }}>Explore available subjects and their question bank depth.</p>
      </div>

      {subjects.length === 0 ? (
        <div className="glass-card text-center py-20">
          <div style={{ fontSize: 56, marginBottom: 16 }}>📭</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>No subjects yet</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>Be the first! Upload past questions to start building the knowledge base.</div>
          <Link href="/upload/questions" className="btn-primary-glow inline-flex items-center gap-2 mt-6 px-6 py-3 text-sm no-underline">
            📤 Upload Questions
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map((sub: { id: number; name: string; questions_count: number; years_count: number; earliest_year: number; latest_year: number }) => (
            <Link
              key={sub.id}
              href={`/predict?subject=${encodeURIComponent(sub.name)}&year=${new Date().getFullYear()}`}
              className="glass-card no-underline block"
              style={{ padding: "24px" }}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>📘</div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>{sub.name}</h3>
              <div className="flex flex-wrap gap-3 text-xs" style={{ color: "var(--text-muted)" }}>
                <span>📄 {sub.questions_count} questions</span>
                <span>📅 {sub.years_count} years</span>
                {sub.earliest_year && sub.latest_year && (
                  <span>🗓️ {sub.earliest_year}–{sub.latest_year}</span>
                )}
              </div>
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--violet-light)" }}>Predict now →</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}