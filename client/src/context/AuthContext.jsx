import { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/auth/me').then(data => setUser(data.user)).catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  useEffect(() => {
    const preference = user?.themePreference || localStorage.getItem('teamforge-theme') || 'system';
    const apply = () => {
      const theme = preference === 'system' ? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : preference;
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme;
    };
    apply();
    if (preference !== 'system') return;
    const media = matchMedia('(prefers-color-scheme: dark)'); media.addEventListener('change', apply); return () => media.removeEventListener('change', apply);
  }, [user?.themePreference]);
  async function login(email, password) { const data = await api.post('/auth/login', { email, password }); setUser(data.user); }
  async function register(name, email, password) { const data = await api.post('/auth/register', { name, email, password }); setUser(data.user); }
  async function logout() { await api.post('/auth/logout'); setUser(null); }
  async function updateProfile(changes) { const data = await api.patch('/auth/me', changes); setUser(data.user); localStorage.setItem('teamforge-theme', data.user.themePreference); return data.user; }
  return <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
