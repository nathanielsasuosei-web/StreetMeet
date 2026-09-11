import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { authApi, tokenStore, profileApi } from "../lib/api.js";
import { connectSocket, disconnectSocket } from "../lib/socket.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [likes, setLikes] = useState({ likesToday: 0, limit: 20, remaining: 20 });
  const [loading, setLoading] = useState(true);

  const applySession = useCallback((session) => {
    if (!session) return;
    tokenStore.set(session.token);
    setUser(session.user);
    if (session.likes) setLikes(session.likes);
    connectSocket();
  }, []);

  // Restore the session on first load
  useEffect(() => {
    if (!tokenStore.get()) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then((data) => {
        setUser(data.user);
        setLikes(data.likes);
        connectSocket();
      })
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (payload) => {
      const data = await authApi.login(payload);
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const register = useCallback(
    async (payload) => {
      const data = await authApi.register(payload);
      applySession(data);
      return data.user;
    },
    [applySession]
  );

  const logout = useCallback(() => {
    disconnectSocket();
    tokenStore.clear();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const data = await authApi.me();
    setUser(data.user);
    setLikes(data.likes);
    return data.user;
  }, []);

  const saveProfile = useCallback(async (payload) => {
    const data = await profileApi.update(payload);
    setUser(data.user);
    return data.user;
  }, []);

  const value = useMemo(
    () => ({ user, setUser, likes, setLikes, loading, login, register, logout, refresh, saveProfile }),
    [user, likes, loading, login, register, logout, refresh, saveProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
