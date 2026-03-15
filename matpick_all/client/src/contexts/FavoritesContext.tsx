/*
 * FavoritesContext — 식당 찜하기(즐겨찾기) 관리
 * localStorage 기반, 로그인 사용자별 데이터 분리
 * 하트 아이콘: 빈 하트 → 클릭 시 빨간색 채워진 하트
 */
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthContext";

interface FavoritesContextType {
  favorites: Set<string>;
  isFavorite: (restaurantId: string) => boolean;
  toggleFavorite: (restaurantId: string) => boolean; // returns new state
  favoritesCount: number;
}

const FavoritesContext = createContext<FavoritesContextType | undefined>(undefined);

function getStorageKey(userId: string) {
  return `matpick_favorites_${userId}`;
}

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const { user, isLoggedIn } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  // Load favorites when user changes
  useEffect(() => {
    if (isLoggedIn && user) {
      try {
        const stored = localStorage.getItem(getStorageKey(user.id));
        if (stored) {
          setFavorites(new Set(JSON.parse(stored)));
        } else {
          setFavorites(new Set());
        }
      } catch {
        setFavorites(new Set());
      }
    } else {
      setFavorites(new Set());
    }
  }, [user, isLoggedIn]);

  // Save to localStorage whenever favorites change
  const saveFavorites = useCallback((newFavorites: Set<string>) => {
    if (user) {
      localStorage.setItem(getStorageKey(user.id), JSON.stringify(Array.from(newFavorites)));
    }
  }, [user]);

  const isFavorite = useCallback((restaurantId: string) => {
    return favorites.has(restaurantId);
  }, [favorites]);

  const toggleFavorite = useCallback((restaurantId: string) => {
    const newFavorites = new Set(favorites);
    let newState: boolean;
    if (newFavorites.has(restaurantId)) {
      newFavorites.delete(restaurantId);
      newState = false;
    } else {
      newFavorites.add(restaurantId);
      newState = true;
    }
    setFavorites(newFavorites);
    saveFavorites(newFavorites);
    return newState;
  }, [favorites, saveFavorites]);

  return (
    <FavoritesContext.Provider value={{
      favorites,
      isFavorite,
      toggleFavorite,
      favoritesCount: favorites.size,
    }}>
      {children}
    </FavoritesContext.Provider>
  );
}

export function useFavorites() {
  const ctx = useContext(FavoritesContext);
  if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
  return ctx;
}
