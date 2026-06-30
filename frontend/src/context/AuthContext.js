'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Bootstrap the session from the httpOnly cookie (no tokens in JS/localStorage).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authApi.me();
        if (!cancelled) {
          setUser(res.data);
          setAuthed(true);
        }
      } catch {
        // request() already attempts a silent refresh on 401; if we're here the
        // session is genuinely gone.
        if (!cancelled) {
          setUser(null);
          setAuthed(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Called by the login/register pages after the API has set the auth cookies.
  function login(userData) {
    setUser(userData || null);
    setAuthed(true);
    router.push('/dashboard');
  }

  async function logout() {
    try {
      await authApi.logout();
    } catch {
      // best-effort
    }
    setUser(null);
    setAuthed(false);
    router.push('/login');
  }

  // `token` is a sentinel kept for backward compatibility: pages use it only as
  // an "is authenticated" flag. The real credential lives in an httpOnly cookie.
  const token = authed ? 'cookie' : null;

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
