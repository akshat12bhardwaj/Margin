import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  const refresh = useCallback(async () => {
    const { user: current, googleEnabled: enabled } = await api.get('/auth/me');
    setUser(current);
    setGoogleEnabled(enabled);
    return current;
  }, []);

  useEffect(() => {
    refresh().catch(() => setUser(null)).finally(() => setReady(true));
    const expired = () => setUser(null);
    window.addEventListener('auth:expired', expired);
    return () => window.removeEventListener('auth:expired', expired);
  }, [refresh]);

  const value = useMemo(
    () => ({
      user,
      ready,
      googleEnabled,
      setUser,
      refresh,
      isAdmin: user?.role === 'admin',
      // Allowed to buy, sell, message and report.
      canTrade: user?.status === 'active' && user?.role !== 'admin',
      login: async (body) => {
        const res = await api.post('/auth/login', body);
        setUser(res.user);
        return res.user;
      },
      register: async (body) => {
        const res = await api.post('/auth/register', body);
        setUser(res.user);
        return res.user;
      },
      logout: async () => {
        await api.post('/auth/logout');
        setUser(null);
      },
    }),
    [user, ready, googleEnabled, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
