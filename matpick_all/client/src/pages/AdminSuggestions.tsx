import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Inbox,
  LoaderCircle,
  MapPin,
  RefreshCw,
} from "lucide-react";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminRegistrationKey, isAdminUser } from "@/lib/admin";
import {
  SUGGESTIONS_API,
  type SuggestionItem,
} from "@/lib/restaurantSuggestions";
import { useSeo } from "@/lib/seo";

const statuses = {
  pending: "검토 대기",
  reviewed: "확인 완료",
  archived: "보류",
};
const relationships = {
  visitor: "방문자 제보",
  owner: "운영자 제보",
  discovered: "추천 제보",
};

export default function AdminSuggestions() {
  const { user, isLoggedIn } = useAuth();
  const allowed = isAdminUser(user);
  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const [notice, setNotice] = useState("");
  useSeo({
    title: "사용자 맛집 제보함",
    description: "사용자가 알려준 식당 정보를 검토합니다.",
    path: "/admin/suggestions",
    robots: "noindex,nofollow",
  });
  useEffect(() => {
    if (!allowed || !user) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${SUGGESTIONS_API}&page=${page}`, {
      headers: {
        "x-matpick-admin-key": getAdminRegistrationKey(user),
        "x-matpick-admin-token": user.syncToken || "",
      },
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async response => {
        const body = await response.json().catch(() => null);
        if (!response.ok || !Array.isArray(body?.items))
          throw new Error(body?.error || "제보함을 불러오지 못했습니다.");
        if (controller.signal.aborted) return;
        setItems(body.items);
        setTotal(body.total);
        setLoading(false);
      })
      .catch(reason => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error ? reason.message : "연결에 실패했습니다."
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [allowed, user, page, reload]);
  async function update(
    item: SuggestionItem,
    status: SuggestionItem["status"]
  ) {
    if (!user || saving) return;
    setSaving(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(SUGGESTIONS_API, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-matpick-admin-key": getAdminRegistrationKey(user),
          "x-matpick-admin-token": user.syncToken || "",
        },
        body: JSON.stringify({ requestId: item.requestId, status }),
        signal: AbortSignal.timeout(20000),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.ok)
        throw new Error(body?.error || "상태를 변경하지 못했습니다.");
      setItems(current =>
        current.map(entry =>
          entry.id === item.id ? { ...entry, status } : entry
        )
      );
      setNotice(`${item.name}: ${statuses[status]}로 변경했습니다.`);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "저장에 실패했습니다."
      );
    } finally {
      setSaving("");
    }
  }
  if (!isLoggedIn || !user || !allowed)
    return (
      <main className="mx-auto max-w-lg px-5 py-20">
        <Link href="/admin" className="text-sm text-[#b34460]">
          관리자 대시보드
        </Link>
        <h1 className="my-5 text-2xl font-black">관리자 로그인이 필요합니다</h1>
        <p className="mb-6 text-sm text-gray-600">
          제보 원문은 관리자만 확인할 수 있습니다.
        </p>
        {!isLoggedIn && <SocialLoginButtons redirectTo="/admin/suggestions" />}
      </main>
    );
  return (
    <main className="min-h-screen bg-[#faf7f8] px-4 py-8 text-[#392c33] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-[#866674]"
        >
          <ArrowLeft size={16} /> 관리자 대시보드
        </Link>
        <header className="my-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-bold tracking-wider text-[#b64b67]">
              COMMUNITY PICKS
            </p>
            <h1 className="text-2xl font-black sm:text-3xl">
              사용자 맛집 제보함
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-[#896b7a]">
              접수된 정보를 확인하고 처리 상태를 기록하세요. 확인 완료는 검토
              표시이며, 공개 지도에 자동 등록되지는 않습니다. 원문은 접수 후
              180일간 보관됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReload(value => value + 1)}
            disabled={loading || Boolean(saving)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#e2d4db] bg-white px-4 text-sm disabled:opacity-50"
          >
            <RefreshCw size={16} /> 새로고침
          </button>
        </header>
        <div className="mb-5 flex items-center justify-between text-sm">
          <span>
            보관 중인 제보 <b>{total.toLocaleString()}건</b>
          </span>
          <Link href="/suggest" className="text-[#a63b59]">
            제보 화면 보기 ↗
          </Link>
        </div>
        {error && (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {error}
            <button
              type="button"
              className="ml-3 underline"
              onClick={() => setReload(value => value + 1)}
            >
              다시 불러오기
            </button>
          </div>
        )}
        <p role="status" className="mb-3 text-sm text-[#8d4360]">
          {notice}
        </p>
        {loading ? (
          <div
            role="status"
            className="flex items-center justify-center gap-2 rounded-2xl border border-[#e8dce2] bg-white p-14 text-sm text-[#886a79]"
          >
            <LoaderCircle
              className="animate-spin motion-reduce:animate-none"
              size={18}
            />{" "}
            제보를 불러오는 중
          </div>
        ) : !items.length && !error ? (
          <div className="rounded-2xl border border-dashed border-[#dcc8d2] bg-white py-20 text-center">
            <Inbox className="mx-auto mb-4 text-[#c08c9f]" size={36} />
            <h2 className="font-bold">아직 접수된 제보가 없어요</h2>
            <p className="mt-2 text-sm text-[#917784]">
              사용자가 설문을 보내면 이곳에 모입니다.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {items.map(item => (
              <details
                key={item.id}
                className="group overflow-hidden rounded-2xl border border-[#e6d6df] bg-white"
                open={items.length === 1 ? true : undefined}
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 focus-visible:outline-2 focus-visible:outline-[#b54f6c] sm:p-6">
                  <div className="min-w-0">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${item.status === "pending" ? "bg-[#fff0de] text-[#95630d]" : item.status === "reviewed" ? "bg-[#eaf5ee] text-[#35764d]" : "bg-[#f2edf0] text-[#836b77]"}`}
                      >
                        {statuses[item.status]}
                      </span>
                      <span className="text-[11px] text-[#977a89]">
                        {relationships[item.relationship]} ·{" "}
                        {new Date(item.createdAt).toLocaleDateString("ko-KR")}
                      </span>
                    </div>
                    <h2 className="break-words text-lg font-bold">
                      {item.name}
                    </h2>
                    <p className="mt-1 flex items-start gap-1 break-all text-xs leading-5 text-[#8c7280]">
                      <MapPin size={13} className="mt-1 shrink-0" />
                      {item.location}
                    </p>
                  </div>
                  <ChevronRight
                    size={19}
                    className="shrink-0 text-[#a4778c] transition group-open:rotate-90"
                  />
                </summary>
                <div className="border-t border-[#f0e7ec] p-5 sm:p-6">
                  {item.mapUrl && (
                    <a
                      href={item.mapUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-5 inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#fbf0f4] px-3 text-xs font-bold text-[#aa4467]"
                    >
                      제보자가 제공한 링크 <ExternalLink size={13} />
                    </a>
                  )}
                  <div className="grid gap-6 sm:grid-cols-2">
                    <section>
                      <h3 className="mb-3 text-xs font-bold text-[#987180]">
                        메뉴 · 가격
                      </h3>
                      {item.menus.length ? (
                        <ul className="divide-y divide-[#eee5e9]">
                          {item.menus.map((menu, i) => (
                            <li
                              key={i}
                              className="flex justify-between gap-3 py-2 text-sm"
                            >
                              <span>
                                {menu.name}
                                {menu.unit && (
                                  <small className="ml-1 text-[#977e8a]">
                                    ({menu.unit})
                                  </small>
                                )}
                              </span>
                              <strong className="shrink-0">
                                {menu.price === null
                                  ? "가격 미제보"
                                  : `${menu.price.toLocaleString()}원`}
                              </strong>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-[#947e88]">
                          메뉴 정보 미제보
                        </p>
                      )}
                      <p className="mt-3 text-xs leading-6 text-[#987e8b]">
                        정보 확인일: {item.checkedAt || "미제보"}
                        <br />
                        확인 출처: {item.sourceNote || "미제보"}
                      </p>
                    </section>
                    <section>
                      <h3 className="mb-3 text-xs font-bold text-[#987180]">
                        추천 이유
                      </h3>
                      <p className="whitespace-pre-wrap break-words text-sm leading-7">
                        {item.reason || "추천 이유 미제보"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {item.tags.map(tag => (
                          <span
                            className="rounded-full bg-[#f7eef2] px-3 py-1 text-xs text-[#9f5872]"
                            key={tag}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </section>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2 border-t border-[#eee2e8] pt-5">
                    {(Object.keys(statuses) as SuggestionItem["status"][]).map(
                      status => (
                        <button
                          key={status}
                          type="button"
                          disabled={Boolean(saving) || item.status === status}
                          onClick={() => update(item, status)}
                          className="inline-flex min-h-10 items-center gap-1 rounded-lg border border-[#dcc6d1] px-3 text-xs font-semibold text-[#93516d] hover:bg-[#fbf1f5] disabled:opacity-40"
                        >
                          {item.status === status && <Check size={13} />}
                          {saving === item.id ? "저장 중" : statuses[status]}
                        </button>
                      )
                    )}
                  </div>
                  <p className="mt-4 break-all text-[10px] text-[#a48d98]">
                    접수 번호 {item.id}
                  </p>
                </div>
              </details>
            ))}
          </div>
        )}
        {!loading && total > 50 && (
          <nav
            aria-label="제보함 페이지"
            className="mt-6 flex items-center justify-center gap-4"
          >
            <button
              type="button"
              aria-label="이전 페이지"
              disabled={page === 0 || Boolean(saving)}
              onClick={() => setPage(value => value - 1)}
              className="rounded-lg border p-3 disabled:opacity-30"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm">
              {page + 1} / {Math.ceil(total / 50)}
            </span>
            <button
              type="button"
              aria-label="다음 페이지"
              disabled={(page + 1) * 50 >= total || Boolean(saving)}
              onClick={() => setPage(value => value + 1)}
              className="rounded-lg border p-3 disabled:opacity-30"
            >
              <ChevronRight size={18} />
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}
