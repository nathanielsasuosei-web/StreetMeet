import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, tokenStore, type User } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

type Likes = { likesToday: number; limit: number; remaining: number };

type AuthValue = {
  user: User | null;
  likes: Likes;
  loading: boolean;
  login: (payload: { email: string; password: string }) => Promise<User>;
  register: (payload: Record<string, unknown>) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  setUser: (user: User) => void;
};

const AuthContext = createContext<AuthValue | null>(null);

const EMPTY_LIKES: Likes = { likesToday: 0, limit: 20, remaining: 20 };

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [likes, setLikes] = useState<Likes>(EMPTY_LIKES);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await tokenStore.get();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const data = await authApi.me();
        setUser(data.user);
        setLikes(data.likes);
        await connectSocket();
      } catch {
        await tokenStore.set(null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const applySession = useCallback(async (session: { token: string; user: User; likes?: Likes }) => {
    await tokenStore.set(session.token);
    setUser(session.user);
    if (session.likes) setLikes(session.likes);
    await connectSocket();
  }, []);

  const login = useCallback(
    async (payload: { email: string; password: string }) => {
      const session = await authApi.login(payload);
      await applySession(session);
      return session.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload: Record<string, unknown>) => {
      const session = await authApi.register(payload);
      await applySession(session);
      return session.user;
    },
    [applySession]
  );

  const logout = useCallback(async () => {
    disconnectSocket();
    await tokenStore.set(null);
    setUser(null);
    setLikes(EMPTY_LIKES);
  }, []);

  const refresh = useCallback(async () => {
    const data = await authApi.me();
    setUser(data.user);
    setLikes(data.likes);
  }, []);

  const value = useMemo(
    () => ({ user, likes, loading, login, register, logout, refresh, setUser }),
    [user, likes, loading, login, register, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
