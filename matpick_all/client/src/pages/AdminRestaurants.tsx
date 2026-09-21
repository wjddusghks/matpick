import { useEffect, useState } from "react";
import { Link } from "wouter";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import RestaurantManager, {
  type ManagerView,
  type SaveRestaurantInput,
} from "@/components/admin/RestaurantManager";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRestaurantMenuItems,
  getSourcesByRestaurant,
  restaurants,
  sources,
} from "@/data";
import { getAdminRegistrationKey, isAdminUser } from "@/lib/admin";
import type { RestaurantEdit } from "@/lib/restaurantEdits";
import { useSeo } from "@/lib/seo";

const VIEW_KEY = "matpick_admin_restaurant_view_v2";
function readView(): ManagerView {
  const params = new URLSearchParams(window.location.search);
  let view: ManagerView = {};
  if (params.get("saved") === "1") {
    try {
      const stored = JSON.parse(sessionStorage.getItem(VIEW_KEY) || "null");
      if (stored && Date.now() - stored.savedAt < 8 * 60 * 60 * 1000)
        view = stored;
    } catch {
      /* Session storage can be unavailable in private browsing. */
    }
  }
  return { ...view, selectedId: params.get("restaurantId") || view.selectedId };
}

export default function AdminRestaurants() {
  const { user, isLoggedIn } = useAuth();
  const allowed = isAdminUser(user);
  const [edits, setEdits] = useState<RestaurantEdit[]>([]);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [initialView] = useState(readView);
  const saved =
    new URLSearchParams(window.location.search).get("saved") === "1";
  useSeo({
    title: "식당 · 메뉴 · 가격 관리",
    description: "맛픽 관리자 식당 편집 화면",
    path: "/admin/restaurants",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    if (!allowed || !user) return;
    const controller = new AbortController();
    setReady(false);
    setLoadError("");
    fetch("/api/restaurants?scope=admin", {
      headers: {
        "x-matpick-admin-key": getAdminRegistrationKey(user),
        "x-matpick-admin-token": user.syncToken || "",
      },
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(
            body.error || "식당 관리 정보를 불러오지 못했습니다."
          );
        if (controller.signal.aborted) return;
        setEdits(body.edits);
        setConfigured(body.configured);
        setReady(true);
      })
      .catch(reason => {
        if (!controller.signal.aborted)
          setLoadError(
            reason instanceof Error
              ? reason.message
              : "불러오기에 실패했습니다."
          );
      });
    return () => controller.abort();
  }, [allowed, user, retry]);

  async function save(input: SaveRestaurantInput): Promise<RestaurantEdit> {
    if (!allowed || !user) throw new Error("관리자 로그인이 필요합니다.");
    const response = await fetch("/api/restaurants", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-matpick-admin-key": getAdminRegistrationKey(user),
        "x-matpick-admin-token": user.syncToken || "",
      },
      body: JSON.stringify(input),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "저장하지 못했습니다.");
    return body.edit;
  }
  function savedView(view: ManagerView) {
    try {
      sessionStorage.setItem(
        VIEW_KEY,
        JSON.stringify({ ...view, savedAt: Date.now() })
      );
    } catch {
      /* Saving data must still succeed without session storage. */
    }
    // Reload every catalog index after a durable write while preserving the editor's view.
    window.location.replace(
      `/admin/restaurants?restaurantId=${encodeURIComponent(view.selectedId || "")}&saved=1`
    );
  }
  if (!isLoggedIn || !user || !allowed)
    return (
      <main className="mx-auto max-w-lg px-5 py-20">
        <Link href="/admin" className="text-sm text-[#ed647c]">
          관리자 대시보드
        </Link>
        <h1 className="my-5 text-2xl font-black">관리자 로그인이 필요합니다</h1>
        <p className="mb-6 text-sm text-gray-600">
          관리자로 등록된 카카오·네이버 계정만 식당 정보를 수정할 수 있습니다.
        </p>
        {!isLoggedIn && <SocialLoginButtons redirectTo="/admin/restaurants" />}
      </main>
    );
  return (
    <RestaurantManager
      restaurants={restaurants}
      sources={sources}
      initialEdits={edits}
      getMenus={getRestaurantMenuItems}
      getSources={getSourcesByRestaurant}
      configured={configured}
      ready={ready}
      loadError={loadError}
      onRetry={() => setRetry(n => n + 1)}
      onSave={save}
      onSaved={savedView}
      initialView={initialView}
      saved={saved}
    />
  );
}
