const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || ''

export interface User {
  id: number
  email: string
  name: string | null
  avatar_url: string | null
  provider: string
  email_verified: boolean
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

export function setToken(token: string) {
  localStorage.setItem('auth_token', token)
}

export function removeToken() {
  localStorage.removeItem('auth_token')
  localStorage.removeItem('auth_user')
}

export function getUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('auth_user')
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

export function setUser(user: User) {
  localStorage.setItem('auth_user', JSON.stringify(user))
}

export async function fetchMe(): Promise<User | null> {
  const token = getToken()
  if (!token) return null
  try {
    const res = await fetch(`${BACKEND}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!res.ok) { removeToken(); return null }
    const data = await res.json()
    setUser(data.user)
    return data.user
  } catch { return null }
}

export function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function loginWithGoogle() {
  window.location.href = `${BACKEND}/auth/google`
}

export function loginWithGithub() {
  window.location.href = `${BACKEND}/auth/github`
}