import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  clearStoredAuthToken,
  getStoredAuthToken,
  setUnauthorizedHandler,
  unlockSite,
} from "@/lib/api";

type AuthContextValue = {
  ready: boolean;
  isUnlocked: boolean;
  unlock: (password: string) => Promise<{ ok: boolean; error?: string }>;
  lock: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);

  const lock = useCallback(async () => {
    await clearStoredAuthToken();
    setIsUnlocked(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = await getStoredAuthToken();
      if (!cancelled) {
        setIsUnlocked(!!token);
        setReady(true);
      }
    })();
    setUnauthorizedHandler(() => setIsUnlocked(false));
    return () => {
      cancelled = true;
      setUnauthorizedHandler(null);
    };
  }, []);

  const unlock = useCallback(async (password: string) => {
    const result = await unlockSite(password);
    if (result.ok) {
      setIsUnlocked(true);
      return { ok: true };
    }
    return { ok: false, error: result.error };
  }, []);

  return (
    <AuthContext.Provider value={{ ready, isUnlocked, unlock, lock }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
