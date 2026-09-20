import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ExternalLink,
  Plus,
  RotateCcw,
  Save,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import {
  getRestaurantMenuItems,
  getSourcesByRestaurant,
  restaurants,
  sources,
} from "@/data";
import type { MenuItem, Restaurant } from "@/data/types";
import { getAdminRegistrationKey, isAdminUser } from "@/lib/admin";
import {
  applyRestaurantEdits,
  type RestaurantEdit,
} from "@/lib/restaurantEdits";
import { getOperationState } from "@/lib/restaurantEligibility";
import { useSeo } from "@/lib/seo";

const inputClass =
  "mt-1 w-full rounded-xl border border-[#e6dce0] bg-white px-3 py-2.5 text-sm text-[#292327] outline-none focus:border-[#ed647c] focus:ring-2 focus:ring-[#ffe0e7] disabled:bg-gray-100";
const buttonClass =
  "inline-flex items-center justify-center gap-2 rounded-xl border border-[#e6dce0] bg-white px-4 py-2.5 text-sm font-bold hover:border-[#ed647c] disabled:cursor-not-allowed disabled:opacity-50";
const states = {
  unknown: "미확인",
  operating: "영업",
  temporarily_closed: "휴업",
  moved: "이전",
  closed: "폐업",
};
const PAGE_SIZE = 24;

type Draft = {
  name: string;
  address: string;
  region: string;
  category: string;
  phone: string;
  lat: string;
  lng: string;
  operationState: NonNullable<Restaurant["operationState"]>;
  menus: MenuItem[];
  menuPriceVerifiedAt: string;
  menuPriceNote: string;
  menuPriceSources: Array<{ url: string; label: string }>;
};

function toDraft(restaurant: Restaurant): Draft {
  return {
    name: restaurant.name,
    address: restaurant.address,
    region: restaurant.region,
    category: restaurant.category,
    phone: restaurant.phone || "",
    lat: String(restaurant.lat),
    lng: String(restaurant.lng),
    operationState: getOperationState(restaurant),
    menus: getRestaurantMenuItems(restaurant).map(menu => ({
      ...menu,
      price: menu.price || "",
      description: menu.description || "",
    })),
    menuPriceVerifiedAt: (
      restaurant.menuPriceVerifiedAt ||
      restaurant.detailCollectedAt ||
      ""
    ).slice(0, 10),
    menuPriceNote: restaurant.menuPriceNote || "",
    menuPriceSources: (restaurant.menuPriceSources || []).map(source => ({
      url: source.url,
      label: source.label || "",
    })),
  };
}

function Field({
  label,
  value,
  onChange,
  required = false,
  type = "text",
  maxLength = 500,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  maxLength?: number;
}) {
  return (
    <label className="block text-xs font-bold text-[#79676f]">
      {label}
      <input
        className={inputClass}
        value={value}
        onChange={event => onChange(event.target.value)}
        required={required}
        type={type}
        maxLength={maxLength}
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}

export default function AdminRestaurants() {
  const { user, isLoggedIn } = useAuth();
  const allowed = isAdminUser(user);
  const [edits, setEdits] = useState<RestaurantEdit[]>([]);
  const [ready, setReady] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const savedSuccessfully = useRef(false);
  const editorRef = useRef<HTMLElement>(null);
  const [query, setQuery] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get("restaurantId") || ""
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [initialDraft, setInitialDraft] = useState("");
  const [showReset, setShowReset] = useState(false);
  const records = useMemo(
    () => applyRestaurantEdits(restaurants, edits),
    [edits]
  );
  const selected = records.find(restaurant => restaurant.id === selectedId);
  const edit = edits.find(item => item.restaurantId === selectedId);
  const dirty = Boolean(draft && JSON.stringify(draft) !== initialDraft);
  const saved =
    new URLSearchParams(window.location.search).get("saved") === "1";
  const editIds = useMemo(
    () =>
      new Set(
        edits
          .filter(item => Object.keys(item.changes).length > 0)
          .map(item => item.restaurantId)
      ),
    [edits]
  );
  const missingMenus = records.filter(
    restaurant => !getRestaurantMenuItems(restaurant).length
  ).length;
  const missingPrices = records.filter(
    restaurant =>
      !getRestaurantMenuItems(restaurant).some(menu => menu.price?.trim())
  ).length;
  const filtered = useMemo(() => {
    const term = query.trim().replace(/\s/g, "").toLowerCase();
    return records.filter(restaurant => {
      const menus = getRestaurantMenuItems(restaurant);
      if (filter === "menus" && menus.length > 0) return false;
      if (filter === "prices" && menus.some(menu => menu.price?.trim()))
        return false;
      if (filter === "edited" && !editIds.has(restaurant.id)) return false;
      if (
        sourceId &&
        !getSourcesByRestaurant(restaurant.id).some(
          source => source.id === sourceId
        )
      )
        return false;
      return (
        !term ||
        [
          restaurant.name,
          restaurant.address,
          restaurant.category,
          ...menus.map(menu => menu.name),
        ]
          .join(" ")
          .replace(/\s/g, "")
          .toLowerCase()
          .includes(term)
      );
    });
  }, [records, query, filter, sourceId, editIds]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);

  useSeo({
    title: "식당 · 메뉴 · 가격 관리",
    description: "맛픽 관리자 식당 편집 화면",
    path: "/admin/restaurants",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    if (!allowed || !user) return;
    const controller = new AbortController();
    fetch("/api/admin/restaurants", {
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
        setEdits(body.edits);
        setConfigured(body.configured);
        setReady(true);
      })
      .catch(reason => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error
              ? reason.message
              : "불러오기에 실패했습니다."
          );
      });
    return () => controller.abort();
  }, [allowed, user]);

  useEffect(() => {
    if (!ready || !selected) return;
    const next = toDraft(selected);
    setDraft(next);
    setInitialDraft(JSON.stringify(next));
    setShowReset(false);
  }, [ready, selected]);

  useEffect(() => {
    if (
      ready &&
      selectedId &&
      window.matchMedia("(max-width: 1279px)").matches
    ) {
      editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [ready, selectedId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (savedSuccessfully.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function choose(id: string) {
    if (
      saving ||
      (dirty &&
        !window.confirm("저장하지 않은 수정 내용을 버리고 다른 식당을 열까요?"))
    )
      return;
    setSelectedId(id);
    setError("");
  }

  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft(current => (current ? { ...current, [key]: value } : current));
  }
  function updateMenu(index: number, patch: Partial<MenuItem>) {
    if (draft)
      update(
        "menus",
        draft.menus.map((menu, i) =>
          i === index ? { ...menu, ...patch } : menu
        )
      );
  }

  async function save(action: "save" | "reset") {
    if (!user || !selected || !draft || saving) return;
    setError("");
    setSaving(true);
    try {
      const initial = JSON.parse(initialDraft) as Draft;
      const changes: Record<string, unknown> = Object.fromEntries(
        Object.entries(draft).filter(
          ([key, value]) =>
            JSON.stringify(value) !==
            JSON.stringify(initial[key as keyof Draft])
        )
      );
      if ("lat" in changes) changes.lat = Number(draft.lat);
      if ("lng" in changes) changes.lng = Number(draft.lng);
      if ("menus" in changes) {
        changes.menuPriceVerifiedAt = draft.menuPriceVerifiedAt;
        changes.menuPriceSources = draft.menuPriceSources;
        changes.menuPriceNote = draft.menuPriceNote;
      }
      if ("menuPriceSources" in changes)
        changes.menuPriceSources = draft.menuPriceSources.filter(source =>
          source.url.trim()
        );
      const response = await fetch("/api/admin/restaurants", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-matpick-admin-key": getAdminRegistrationKey(user),
          "x-matpick-admin-token": user.syncToken || "",
        },
        body: JSON.stringify({
          restaurantId: selected.id,
          expectedRevision: edit?.revision || 0,
          action,
          changes,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "저장하지 못했습니다.");
      // Reload after a durable write so every catalog index, map and detail uses the same revision.
      savedSuccessfully.current = true;
      setInitialDraft(JSON.stringify(draft));
      setDraft(null);
      window.setTimeout(
        () =>
          window.location.replace(
            `/admin/restaurants?restaurantId=${encodeURIComponent(selected.id)}&saved=1`
          ),
        0
      );
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "저장하지 못했습니다."
      );
      setSaving(false);
    }
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
        {!isLoggedIn ? (
          <SocialLoginButtons redirectTo="/admin/restaurants" />
        ) : null}
      </main>
    );

  return (
    <main className="min-h-screen bg-[#fff8f9] px-4 py-7 text-[#292327] sm:px-8">
      <div className="mx-auto max-w-[1440px]">
        <Link
          href="/admin"
          onClick={event => {
            if (
              dirty &&
              !window.confirm("저장하지 않은 수정 내용을 버리고 이동할까요?")
            )
              event.preventDefault();
          }}
          className="inline-flex items-center gap-2 text-sm font-bold text-[#dc516c]"
        >
          <ArrowLeft size={16} /> 운영 대시보드
        </Link>
        <header className="mt-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-black tracking-widest text-[#dc516c]">
              RESTAURANT MANAGER
            </p>
            <h1 className="mt-2 text-3xl font-black">
              식당 · 메뉴 · 가격 관리
            </h1>
            <p className="mt-3 text-sm text-[#79676f]">
              저장한 수정 사항은 식당 검색과 상세 화면에 반영되고, 다음 배포에도
              유지됩니다.
            </p>
          </div>
          <a href="/" target="_blank" rel="noreferrer" className={buttonClass}>
            사이트 보기 <ExternalLink size={14} />
          </a>
        </header>
        <div className="my-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            ["전체 식당", records.length],
            ["메뉴 확인 필요", missingMenus],
            ["가격 확인 필요", missingPrices],
            ["관리자 수정", editIds.size],
          ].map(([label, count]) => (
            <div
              key={label}
              className="rounded-2xl border border-[#eadfe2] bg-white p-4"
            >
              <p className="text-xs font-bold text-[#79676f]">{label}</p>
              <p className="mt-2 text-2xl font-black">
                {Number(count).toLocaleString()}
                <span className="ml-1 text-xs font-medium">곳</span>
              </p>
            </div>
          ))}
        </div>
        {saved && !dirty && (
          <p
            role="status"
            className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"
          >
            저장했습니다. 사이트에도 수정한 정보가 반영됩니다.
          </p>
        )}
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}{" "}
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-2 underline"
            >
              새로고침
            </button>
          </div>
        )}
        {ready && !configured && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900"
          >
            식당 저장소가 연결되지 않아 조회만 가능합니다. 저장소 연결 후 수정할
            수 있습니다.
          </p>
        )}
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(340px,0.9fr)_minmax(0,1.4fr)]">
          <section
            aria-label="식당 목록"
            className="min-w-0 rounded-2xl border border-[#eadfe2] bg-white p-4 sm:p-5"
          >
            <label className="relative block">
              <span className="sr-only">식당 검색</span>
              <Search
                size={17}
                className="absolute left-3 top-4 text-[#a79098]"
              />
              <input
                value={query}
                onChange={event => {
                  setQuery(event.target.value);
                  setPage(1);
                }}
                placeholder="식당명, 지역, 메뉴 검색"
                className={`${inputClass} mt-0 pl-10`}
              />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select
                aria-label="주제 필터"
                value={sourceId}
                onChange={event => {
                  setSourceId(event.target.value);
                  setPage(1);
                }}
                className={inputClass}
              >
                <option value="">모든 주제</option>
                {sources.map(source => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="확인 상태 필터"
                value={filter}
                onChange={event => {
                  setFilter(event.target.value);
                  setPage(1);
                }}
                className={inputClass}
              >
                <option value="all">전체 식당</option>
                <option value="menus">메뉴 없는 식당</option>
                <option value="prices">가격 없는 식당</option>
                <option value="edited">관리자 수정 식당</option>
              </select>
            </div>
            <p className="my-4 text-xs text-[#79676f]">
              검색 결과 {filtered.length.toLocaleString()}곳 · {currentPage} /{" "}
              {pageCount}페이지
            </p>
            <div className="max-h-[480px] space-y-2 overflow-y-auto xl:max-h-[680px]">
              {filtered
                .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
                .map(restaurant => {
                  const menus = getRestaurantMenuItems(restaurant);
                  const priced = menus.filter(menu =>
                    menu.price?.trim()
                  ).length;
                  return (
                    <button
                      key={restaurant.id}
                      type="button"
                      disabled={saving}
                      onClick={() => choose(restaurant.id)}
                      aria-pressed={selectedId === restaurant.id}
                      className={`w-full rounded-xl border p-3 text-left transition ${selectedId === restaurant.id ? "border-[#ed647c] bg-[#fff2f5]" : "border-[#eee5e8] hover:bg-[#fffbfc]"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <strong className="text-sm">{restaurant.name}</strong>
                        {editIds.has(restaurant.id) && (
                          <span className="shrink-0 text-[10px] font-bold text-[#dc516c]">
                            수정됨
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-[#79676f]">
                        {restaurant.address}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        <span className="rounded bg-[#f5f1f3] px-2 py-1">
                          메뉴 {menus.length}개
                        </span>
                        <span
                          className={`rounded px-2 py-1 ${priced ? "bg-[#f5f1f3]" : "bg-amber-50 text-amber-800"}`}
                        >
                          가격 {priced ? `${priced}개` : "미확인"}
                        </span>
                        <span className="px-1 py-1 text-[#79676f]">
                          {states[getOperationState(restaurant)]}
                        </span>
                      </div>
                    </button>
                  );
                })}
              {!filtered.length && (
                <p className="py-12 text-center text-sm text-[#79676f]">
                  조건에 맞는 식당이 없습니다.
                </p>
              )}
            </div>
            <div className="mt-4 flex justify-between">
              <button
                type="button"
                className={buttonClass}
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                이전
              </button>
              <button
                type="button"
                className={buttonClass}
                disabled={currentPage === pageCount}
                onClick={() => setPage(currentPage + 1)}
              >
                다음
              </button>
            </div>
          </section>
          <section
            ref={editorRef}
            aria-label="식당 편집"
            className="min-w-0 rounded-2xl border border-[#eadfe2] bg-white p-4 sm:p-6"
          >
            {!ready ? (
              <p role="status" className="py-20 text-center text-sm">
                {error
                  ? "관리자 인증 상태를 확인해 주세요."
                  : "수정 정보를 불러오는 중입니다."}
              </p>
            ) : !selected || !draft ? (
              <div className="py-24 text-center text-[#79676f]">
                <Store className="mx-auto mb-4 h-9 w-9 text-[#e0bec8]" />
                <h2 className="text-lg font-bold">수정할 식당을 선택하세요</h2>
                <p className="mt-2 text-sm">
                  목록을 검색하거나 메뉴·가격 누락 항목부터 확인하세요.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void save("save");
                }}
              >
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[#dc516c]">
                      {getSourcesByRestaurant(selected.id)
                        .map(source => source.name)
                        .join(" · ")}
                    </p>
                    <h2 className="mt-2 text-xl font-black">{selected.name}</h2>
                    {edit?.updatedAt && (
                      <p className="mt-1 text-xs text-[#79676f]">
                        최근 수정{" "}
                        {new Date(edit.updatedAt).toLocaleString("ko-KR")}
                      </p>
                    )}
                  </div>
                  <a
                    href={`/restaurant/${encodeURIComponent(selected.id)}`}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonClass}
                  >
                    <ExternalLink size={14} />
                    <span className="sr-only sm:not-sr-only">상세 보기</span>
                  </a>
                </div>
                <fieldset disabled={saving || !configured}>
                  <legend className="mb-3 font-bold">식당 정보</legend>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="식당명"
                      value={draft.name}
                      onChange={value => update("name", value)}
                      required
                      maxLength={200}
                    />
                    <Field
                      label="지역"
                      value={draft.region}
                      onChange={value => update("region", value)}
                      required
                      maxLength={100}
                    />
                    <div className="sm:col-span-2">
                      <Field
                        label="주소"
                        value={draft.address}
                        onChange={value => update("address", value)}
                        required
                      />
                    </div>
                    <Field
                      label="음식 종류"
                      value={draft.category}
                      onChange={value => update("category", value)}
                      required
                      maxLength={100}
                    />
                    <Field
                      label="전화번호"
                      value={draft.phone}
                      onChange={value => update("phone", value)}
                      maxLength={80}
                    />
                    <Field
                      label="위도"
                      value={draft.lat}
                      onChange={value => update("lat", value)}
                      type="number"
                      required
                    />
                    <Field
                      label="경도"
                      value={draft.lng}
                      onChange={value => update("lng", value)}
                      type="number"
                      required
                    />
                    <label className="block text-xs font-bold text-[#79676f]">
                      영업 상태
                      <select
                        className={inputClass}
                        value={draft.operationState}
                        onChange={event =>
                          update(
                            "operationState",
                            event.target.value as Draft["operationState"]
                          )
                        }
                      >
                        {Object.entries(states).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#79676f]">
                    주소를 바꾸면 위도·경도도 함께 확인하세요.
                    휴업·폐업·이전으로 저장하면 추천 목록에서 제외됩니다.
                  </p>
                  <div className="mb-3 mt-8 flex items-center justify-between">
                    <h3 className="font-bold">
                      메뉴와 가격{" "}
                      <span className="text-[#dc516c]">
                        {draft.menus.length}
                      </span>
                    </h3>
                    <button
                      type="button"
                      className={buttonClass}
                      disabled={draft.menus.length >= 100}
                      onClick={() =>
                        update("menus", [
                          ...draft.menus,
                          {
                            id: `draft-${Date.now()}`,
                            name: "",
                            price: "",
                            description: "",
                            isSignature: false,
                          },
                        ])
                      }
                    >
                      <Plus size={15} /> 메뉴 추가
                    </button>
                  </div>
                  <p className="mb-3 text-xs leading-5 text-[#79676f]">
                    가격은 ‘12,000원’, ‘싯가’처럼 입력하세요. 확인하지 못한
                    가격은 비워 두세요. 대표 메뉴는 목록에 우선 표시합니다.
                  </p>
                  <div className="space-y-3">
                    {draft.menus.map((menu, index) => (
                      <div
                        key={menu.id}
                        className="rounded-xl border border-[#eadfe2] bg-[#fffbfc] p-3"
                      >
                        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.7fr)_auto] items-end gap-2">
                          <Field
                            label={`메뉴명 ${index + 1}`}
                            value={menu.name}
                            onChange={value =>
                              updateMenu(index, { name: value })
                            }
                            required
                            maxLength={200}
                          />
                          <Field
                            label={`가격 ${index + 1}`}
                            value={menu.price || ""}
                            onChange={value =>
                              updateMenu(index, { price: value })
                            }
                            maxLength={120}
                          />
                          <button
                            type="button"
                            aria-label={`메뉴 ${index + 1} 삭제`}
                            className="mb-1 rounded-lg p-2.5 text-[#a0808a] hover:bg-red-50 hover:text-red-600"
                            onClick={() =>
                              update(
                                "menus",
                                draft.menus.filter((_, i) => i !== index)
                              )
                            }
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`signature-${index}`}
                            checked={Boolean(menu.isSignature)}
                            onChange={event =>
                              updateMenu(index, {
                                isSignature: event.target.checked,
                              })
                            }
                            className="accent-[#ed647c]"
                          />
                          <label
                            htmlFor={`signature-${index}`}
                            className="text-xs text-[#79676f]"
                          >
                            대표 메뉴
                          </label>
                        </div>
                      </div>
                    ))}
                    {!draft.menus.length && (
                      <p className="rounded-xl border border-dashed p-6 text-center text-sm text-[#79676f]">
                        등록된 메뉴가 없습니다. 메뉴 추가를 눌러 입력하세요.
                      </p>
                    )}
                  </div>
                  <h3 className="mb-3 mt-8 font-bold">가격 확인 기록</h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field
                      label="가격 확인일 (직접 확인한 날짜)"
                      value={draft.menuPriceVerifiedAt}
                      onChange={value => update("menuPriceVerifiedAt", value)}
                      type="date"
                    />
                    <Field
                      label="가격 안내 (예: 2인 이상 주문)"
                      value={draft.menuPriceNote}
                      onChange={value => update("menuPriceNote", value)}
                      maxLength={1000}
                    />
                  </div>
                  <div className="mt-3 space-y-3">
                    {draft.menuPriceSources.map((source, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2"
                      >
                        <div className="grid gap-2 sm:grid-cols-[1fr_2fr]">
                          <Field
                            label={`출처 이름 ${index + 1}`}
                            value={source.label}
                            onChange={value =>
                              update(
                                "menuPriceSources",
                                draft.menuPriceSources.map((item, i) =>
                                  i === index ? { ...item, label: value } : item
                                )
                              )
                            }
                            maxLength={100}
                          />
                          <Field
                            label={`출처 URL ${index + 1}`}
                            value={source.url}
                            onChange={value =>
                              update(
                                "menuPriceSources",
                                draft.menuPriceSources.map((item, i) =>
                                  i === index ? { ...item, url: value } : item
                                )
                              )
                            }
                            type="url"
                            maxLength={2000}
                          />
                        </div>
                        <button
                          type="button"
                          aria-label={`출처 ${index + 1} 삭제`}
                          className="mb-1 p-2 text-[#a0808a]"
                          onClick={() =>
                            update(
                              "menuPriceSources",
                              draft.menuPriceSources.filter(
                                (_, i) => i !== index
                              )
                            )
                          }
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`${buttonClass} mt-3`}
                    disabled={draft.menuPriceSources.length >= 10}
                    onClick={() =>
                      update("menuPriceSources", [
                        ...draft.menuPriceSources,
                        { url: "", label: "" },
                      ])
                    }
                  >
                    <Plus size={14} /> 출처 추가
                  </button>
                </fieldset>
                <div className="sticky bottom-3 mt-7 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#eadfe2] bg-white/95 p-3 shadow-lg backdrop-blur">
                  <span className="text-xs text-[#79676f]">
                    {dirty
                      ? "저장하지 않은 변경이 있습니다"
                      : "저장된 정보와 같습니다"}
                  </span>
                  <button
                    type="submit"
                    disabled={!configured || !dirty || saving}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#ed647c] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    <Save size={16} />
                    {saving ? "저장 중…" : "변경사항 저장"}
                  </button>
                  {error && (
                    <p role="alert" className="w-full text-sm text-red-700">
                      {error}
                    </p>
                  )}
                </div>
                {editIds.has(selected.id) && (
                  <div className="mt-6 border-t border-[#eadfe2] pt-5">
                    <button
                      type="button"
                      disabled={saving}
                      className="inline-flex items-center gap-2 text-xs text-[#79676f] underline"
                      onClick={() => setShowReset(!showReset)}
                    >
                      <RotateCcw size={13} /> 수집 원본으로 복원
                    </button>
                    {showReset && (
                      <div className="mt-3 rounded-xl bg-amber-50 p-4 text-sm">
                        <p>
                          이 식당에 저장한 관리자 수정 내용을 해제하고 수집
                          원본으로 되돌립니다. 복원 기록은 서버에 남습니다.
                        </p>
                        <button
                          type="button"
                          disabled={saving}
                          className={`${buttonClass} mt-3`}
                          onClick={() => void save("reset")}
                        >
                          원본으로 복원하기
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
