const HISTORY_KEY = 'exam_predictor_history'
const MAX_HISTORY = 10

export function savePredictionToHistory(subject: string, year: number) {
  if (typeof window === 'undefined') return
  const raw = localStorage.getItem(HISTORY_KEY)
  const history: { subject: string; year: number; date: string }[] = raw ? JSON.parse(raw) : []
  const filtered = history.filter(h => !(h.subject === subject && h.year === year))
  filtered.unshift({ subject, year, date: new Date().toISOString() })
  localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)))
}

export function getPredictionHistory(): { subject: string; year: number; date: string }[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]') }
  catch { return [] }
}