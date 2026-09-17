/**
 * API client for the StreetMeet backend.
 *
 * Every URL is relative (`/api/...`), so the browser talks to the same origin
 * that served the app and Vite proxies to the backend. Set VITE_API_URL only
 * when the API really lives on another host.
 */

const BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
const TOKEN_KEY = 'streetmeet.token'

export class ApiError extends Error {
  constructor({ status, message, code, fields }) {
    super(message || 'Something went wrong.')
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fields = fields || {}
  }

  get isAuthError() {
    return this.status === 401 || this.status === 403
  }
}

/* ── token storage ─────────────────────────────────────────────────────── */

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private browsing - the session simply will not survive a reload */
  }
}

export function clearToken() {
  setToken(null)
}

/* ── core request ──────────────────────────────────────────────────────── */

async function request(path, { method = 'GET', body, form, auth = true } = {}) {
  const headers = {}
  const token = getToken()
  if (auth && token) headers.Authorization = `Bearer ${token}`

  let payload
  if (form) {
    payload = form // browser sets the multipart boundary itself
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let response
  try {
    response = await fetch(`${BASE_URL}${path}`, { method, headers, body: payload })
  } catch {
    throw new ApiError({
      status: 0,
      message: 'Cannot reach the StreetMeet API. Is the backend running?',
      code: 'NETWORK_ERROR',
    })
  }

  const text = await response.text()
  let json = null
  if (text) {
    try {
      json = JSON.parse(text)
    } catch {
      json = null
    }
  }

  if (!response.ok) {
    throw new ApiError({
      status: response.status,
      message: json?.message || `Request failed (${response.status})`,
      code: json?.code,
      fields: json?.fields,
    })
  }

  return json?.data !== undefined ? json.data : json
}

const withQuery = (path, params = {}) => {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''),
  ).toString()
  return search ? `${path}?${search}` : path
}

/* ── endpoints ─────────────────────────────────────────────────────────── */

export const api = {
  health: () => request('/api/health', { auth: false }),

  catalogue: () => request('/api/profile/catalogue', { auth: false }),

  auth: {
    register: (payload) => request('/api/auth/register', { method: 'POST', body: payload, auth: false }),
    login: (payload) => request('/api/auth/login', { method: 'POST', body: payload, auth: false }),
    me: () => request('/api/auth/me'),
    logout: () => request('/api/auth/logout', { method: 'POST' }),
    reactivate: (payload) => request('/api/auth/reactivate', { method: 'POST', body: payload, auth: false }),
  },

  profile: {
    me: () => request('/api/profile/me'),
    update: (payload) => request('/api/profile/me', { method: 'PATCH', body: payload }),
    onboard: (payload) => request('/api/profile/onboard', { method: 'POST', body: payload }),
    uploadPhoto: (file) => {
      const form = new FormData()
      form.append('photo', file, file.name)
      return request('/api/profile/photo', { method: 'POST', form })
    },
    removePhoto: () => request('/api/profile/photo', { method: 'DELETE' }),
    preferences: () => request('/api/profile/preferences'),
    updatePreferences: (payload) => request('/api/profile/preferences', { method: 'PATCH', body: payload }),
    publicProfile: (id) => request(`/api/profile/${encodeURIComponent(id)}`),
  },

  settings: {
    get: () => request('/api/settings'),
    update: (payload) => request('/api/settings', { method: 'PATCH', body: payload }),
    changeEmail: (payload) => request('/api/settings/email', { method: 'PATCH', body: payload }),
    changePassword: (payload) => request('/api/settings/password', { method: 'PATCH', body: payload }),
    logoutEverywhere: () => request('/api/settings/logout-everywhere', { method: 'POST' }),
    closeAccount: (payload) => request('/api/settings/account', { method: 'DELETE', body: payload }),
  },

  withQuery,
}

export default api
