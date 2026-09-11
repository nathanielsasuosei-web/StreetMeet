import * as SecureStore from 'expo-secure-store';
import { API_URL } from './config';

const TOKEN_KEY = 'natthesisa.token';

export const tokenStore = {
  get: () => SecureStore.getItemAsync(TOKEN_KEY),
  set: async (token: string | null) => {
    if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
};

type Options = { method?: string; body?: unknown; form?: FormData };

async function request<T>(path: string, { method = 'GET', body, form }: Options = {}): Promise<T> {
  const token = await tokenStore.get();
  const isForm = form instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(isForm ? {} : body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: isForm ? form : body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.message ?? `Request failed (${response.status})`);
  }
  return (data?.data ?? data) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload: <T>(path: string, form: FormData) => request<T>(path, { method: 'POST', form }),
};

/* ------------------------------- endpoints ------------------------------- */

export type User = {
  id: string;
  fullName: string;
  age?: number | null;
  bio?: string | null;
  city?: string | null;
  avatarUrl?: string | null;
  photos: string[];
  interests: string[];
  isPremium: boolean;
  premiumUntil?: string | null;
  role?: string;
  onboarded?: boolean;
  phone?: string | null;
  email?: string;
};

export type Profile = User & { distanceKm?: number | null; verified?: boolean };

export type MatchSummary = {
  id: string;
  partner: Profile;
  lastMessage: { body?: string | null; mediaType?: string; fromMe: boolean; createdAt?: string } | null;
  lastMessageAt: string;
  createdAt: string;
};

export type Message = {
  id: string;
  body?: string | null;
  mediaUrl?: string | null;
  mediaType?: 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO';
  senderId: string;
  fromMe?: boolean;
  seenAt?: string | null;
  createdAt: string;
};

export type Plan = {
  id: string;
  code: string;
  name: string;
  tagline?: string | null;
  pricePesewas: number;
  currency: string;
  durationDays: number;
  features: string[];
  popular: boolean;
};

export const authApi = {
  register: (payload: Record<string, unknown>) => api.post<{ token: string; user: User; likes: any }>('/api/auth/register', payload),
  login: (payload: { email: string; password: string }) => api.post<{ token: string; user: User; likes: any }>('/api/auth/login', payload),
  me: () => api.get<{ user: User; likes: any }>('/api/auth/me'),
};

export const profileApi = {
  update: (payload: Record<string, unknown>) => api.patch<{ user: User }>('/api/profile/me', payload),
  report: (id: string, payload: { reason: string; details?: string }) => api.post(`/api/profile/report/${id}`, payload),
  block: (id: string) => api.post(`/api/profile/block/${id}`, {}),
};

export const discoverApi = {
  feed: (limit = 20) => api.get<{ profiles: Profile[]; likes: any }>(`/api/discover/feed?limit=${limit}`),
  like: (id: string, superLike = false) =>
    api.post<{ matched: boolean; matchId: string | null; likes: any }>(`/api/discover/like/${id}`, { superLike }),
  pass: (id: string) => api.post(`/api/discover/pass/${id}`, {}),
  likers: () => api.get<{ premium: boolean; count: number; likers: (Profile & { blurred?: boolean })[] }>('/api/discover/likes/received'),
};

export const matchApi = {
  list: () => api.get<{ matches: MatchSummary[] }>('/api/matches'),
  get: (id: string) => api.get<{ match: { id: string; partner: Profile } }>(`/api/matches/${id}`),
};

export const chatApi = {
  messages: (matchId: string) => api.get<{ messages: Message[] }>(`/api/chat/${matchId}/messages`),
  send: (matchId: string, body: string) => api.post<{ message: Message }>(`/api/chat/${matchId}/messages`, { body }),
  sendMedia: (matchId: string, form: FormData) => api.upload<{ message: Message }>(`/api/chat/${matchId}/messages`, form),
  seen: (matchId: string) => api.post(`/api/chat/${matchId}/seen`, {}),
};

export const statusApi = {
  feed: () =>
    api.get<{
      feed: { user: Profile; isMine: boolean; unseen: boolean; items: { id: string; caption?: string | null; mediaUrl?: string | null; mediaType?: string; background?: string; createdAt: string; expiresAt: string; viewCount: number; seenByMe: boolean }[] }[];
    }>('/api/status/feed'),
  createText: (payload: { caption: string; background?: string; mediaUrl?: string; mediaType?: string }) => api.post('/api/status', payload),
  create: (form: FormData) => api.upload('/api/status', form),
  view: (id: string) => api.post(`/api/status/${id}/view`, {}),
  viewers: (id: string) => api.get<{ viewers: { viewedAt: string; user: Profile }[] }>(`/api/status/${id}/viewers`),
};

export const callApi = {
  ice: () => api.get<{ iceServers: any[] }>('/api/calls/ice'),
  start: (payload: { matchId: string; type: 'AUDIO' | 'VIDEO' }) =>
    api.post<{ call: { id: string; calleeId: string } }>('/api/calls/start', payload),
  end: (id: string) => api.post(`/api/calls/${id}/end`, {}),
  history: () => api.get<{ calls: any[] }>('/api/calls/history'),
};

export const paymentApi = {
  plans: () => api.get<{ plans: Plan[]; provider: string; currency: string }>('/api/payments/plans'),
  initiate: (payload: { planCode: string; phone: string; network?: string }) =>
    api.post<{ reference: string; status: string; instructions?: string | null }>('/api/payments/initiate', payload),
  check: (reference: string) => api.get<{ status: string; instructions?: string | null; failureReason?: string | null }>(`/api/payments/${reference}`),
  history: () => api.get<{ transactions: any[] }>('/api/payments'),
};
