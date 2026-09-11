/**
 * Tiny fetch wrapper for the natthesisa API.
 * In dev, Vite proxies /api -> http://localhost:5000 (see vite.config.js).
 */
const TOKEN_KEY = "natthesisa.token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => (token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY)),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

async function request(path, { method = "GET", body, raw, headers = {} } = {}) {
  const isForm = body instanceof FormData;
  const token = tokenStore.get();

  const response = await fetch(path, {
    method,
    headers: {
      ...(isForm || raw ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: isForm || raw ? body : body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || data?.error || `Request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.details = data?.details;
    throw error;
  }

  return data?.data ?? data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: "POST", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  del: (path, body) => request(path, { method: "DELETE", body }),
  upload: (path, formData) => request(path, { method: "POST", body: formData }),
  patchForm: (path, formData) => request(path, { method: "PATCH", body: formData }),
};

/* --------------------------- endpoint helpers ----------------------------- */

export const authApi = {
  register: (payload) => api.post("/api/auth/register", payload),
  login: (payload) => api.post("/api/auth/login", payload),
  me: () => api.get("/api/auth/me"),
  changePassword: (payload) => api.post("/api/auth/change-password", payload),
};

export const profileApi = {
  me: () => api.get("/api/profile/me"),
  update: (payload) => api.patch("/api/profile/me", payload),
  updateForm: (formData) => api.patchForm("/api/profile/me", formData),
  removePhoto: (url) => api.del("/api/profile/me/photo", { url }),
  report: (id, payload) => api.post(`/api/profile/report/${id}`, payload),
  block: (id) => api.post(`/api/profile/block/${id}`),
};

export const discoverApi = {
  feed: (limit = 20) => api.get(`/api/discover/feed?limit=${limit}`),
  like: (id, superLike = false) => api.post(`/api/discover/like/${id}`, { superLike }),
  pass: (id) => api.post(`/api/discover/pass/${id}`),
  likers: () => api.get("/api/discover/likes/received"),
  budget: () => api.get("/api/discover/likes/budget"),
};

export const matchApi = {
  list: () => api.get("/api/matches"),
  get: (id) => api.get(`/api/matches/${id}`),
  unmatch: (id) => api.del(`/api/matches/${id}`),
};

export const chatApi = {
  conversations: () => api.get("/api/chat"),
  messages: (matchId, before) => api.get(`/api/chat/${matchId}/messages${before ? `?before=${before}` : ""}`),
  send: (matchId, payload) => api.post(`/api/chat/${matchId}/messages`, payload),
  sendMedia: (matchId, formData) => api.upload(`/api/chat/${matchId}/messages`, formData),
  seen: (matchId) => api.post(`/api/chat/${matchId}/seen`),
};

export const statusApi = {
  feed: () => api.get("/api/status/feed"),
  mine: () => api.get("/api/status/mine"),
  create: (formData) => api.upload("/api/status", formData),
  createText: (payload) => api.post("/api/status", payload),
  view: (id) => api.post(`/api/status/${id}/view`),
  viewers: (id) => api.get(`/api/status/${id}/viewers`),
  remove: (id) => api.del(`/api/status/${id}`),
};

export const callApi = {
  ice: () => api.get("/api/calls/ice"),
  start: (payload) => api.post("/api/calls/start", payload),
  end: (id) => api.post(`/api/calls/${id}/end`),
  history: () => api.get("/api/calls/history"),
};

export const paymentApi = {
  plans: () => api.get("/api/payments/plans"),
  initiate: (payload) => api.post("/api/payments/initiate", payload),
  check: (reference) => api.get(`/api/payments/${reference}`),
  history: () => api.get("/api/payments"),
  simulate: (reference, outcome = "SUCCESS") => api.post("/api/payments/simulate", { reference, outcome }),
};

export const adminApi = {
  stats: () => api.get("/api/admin/stats"),
  users: (search) => api.get(`/api/admin/users${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  setUser: (id, payload) => api.patch(`/api/admin/users/${id}`, payload),
  reports: (status = "OPEN") => api.get(`/api/admin/reports?status=${status}`),
  resolveReport: (id, action) => api.post(`/api/admin/reports/${id}/resolve`, { action }),
};
