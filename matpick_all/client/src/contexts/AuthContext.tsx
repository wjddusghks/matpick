/*
 * AuthContext — 로그인 상태 관리
 * Static 프로젝트이므로 localStorage 기반 시뮬레이션
 * 추후 Manus OAuth 또는 카카오/네이버 OAuth 연동 시 교체 가능
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface User {
  id: string;
  name: string;
  profileImage?: string;
}

interface AuthContextType {
  user: User | null;
  isLoggedIn: boolean;
  login: (user?: User) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = "matpick_auth_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const stored = localStorage.getItem(AUTH_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback((loginUser?: User) => {
    const u = loginUser || {
      id: "demo_user_" + Date.now(),
      name: "맛픽 데모 사용자",
      profileImage: undefined,
    };
    setUser(u);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
