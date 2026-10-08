import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { loadSession, saveSession } from "./session";
import type { Session, User } from "./types";

type AuthValue = {
  user: User | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
};

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => loadSession());

  const value = useMemo<AuthValue>(
    () => ({
      user: session?.user ?? null,
      ready: true,
      async login(email: string, password: string) {
        const next = await api<Session>("/api/auth/login", {
          method: "POST",
          body: { email, password },
        });
        saveSession(next);
        setSession(next);
        return next.user;
      },
      logout() {
        saveSession(null);
        setSession(null);
      },
    }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is missing");
  return value;
}
