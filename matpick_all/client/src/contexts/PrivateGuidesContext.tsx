import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminRegistrationKey, isAdminUser } from "@/lib/admin";
import type {
  PrivateGuideCatalog,
  PrivateGuideRestaurant,
} from "@/lib/privateGuideCatalog";

const emptyRestaurants: PrivateGuideRestaurant[] = [];
const Context = createContext({
  catalog: null as PrivateGuideCatalog | null,
  restaurants: emptyRestaurants,
  allowed: false,
  error: "",
  retry: () => {},
});

export function PrivateGuidesProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const allowed = isAdminUser(user);
  const adminKey = user ? getAdminRegistrationKey(user) : "";
  const token = user?.syncToken || "";
  const identity = allowed && token ? `${adminKey}:${token}` : "";
  const [loaded, setLoaded] = useState<{
    identity: string;
    catalog: PrivateGuideCatalog;
  } | null>(null);
  const [failure, setFailure] = useState<{
    identity: string;
    message: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  const retry = useCallback(() => setRevision(v => v + 1), []);
  useEffect(() => {
    setLoaded(null);
    setFailure(null);
    if (!identity) return;
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    fetch("/api/restaurants?scope=private-guides", {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "x-matpick-admin-key": adminKey,
        "x-matpick-admin-token": token,
      },
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body.error || "가이드를 불러오지 못했습니다.");
        if (
          !Array.isArray(body.restaurants) ||
          !Array.isArray(body.regions) ||
          !(body.expiresAt > Date.now())
        )
          throw new Error("가이드 응답을 확인하지 못했습니다.");
        if (controller.signal.aborted) return;
        setLoaded({ identity, catalog: body });
        timeout = setTimeout(
          () => {
            setLoaded(null);
            retry();
          },
          Math.max(0, body.expiresAt - Date.now())
        );
      })
      .catch(error => {
        if (!controller.signal.aborted)
          setFailure({
            identity,
            message: error.message || "가이드를 불러오지 못했습니다.",
          });
      });
    return () => {
      controller.abort();
      clearTimeout(timeout);
    };
  }, [identity, adminKey, token, revision, retry]);
  // Identity/expiry checks also apply during render, before effects run after logout.
  const catalog =
    identity &&
    loaded?.identity === identity &&
    loaded.catalog.expiresAt > Date.now()
      ? loaded.catalog
      : null;
  return (
    <Context.Provider
      value={{
        catalog,
        restaurants: catalog?.restaurants ?? emptyRestaurants,
        allowed,
        error:
          allowed && !token
            ? "다시 로그인해 관리자 권한을 확인해 주세요."
            : failure?.identity === identity
              ? failure.message
              : "",
        retry,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export const usePrivateGuides = () => useContext(Context);
