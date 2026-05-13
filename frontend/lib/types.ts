export interface Prediction {
  question_text: string
  probability: number
  explanation: string
  historical_years: number[]
  similar_questions: string[]
}

export type UploadState =
  | { success: false; error: string; results: null }
  | { success: true; error?: never; results: { url: string; name: string }[] }