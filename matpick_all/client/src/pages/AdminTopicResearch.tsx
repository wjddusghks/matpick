import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
} from "lucide-react";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminRegistrationKey, isAdminUser } from "@/lib/admin";
import { useSeo } from "@/lib/seo";

type Topic = {
  rank: number;
  id: string;
  name: string;
  candidateRows: number;
  publishedRestaurants: number;
  pendingRows: number;
};
type Row = {
  id: string;
  name: string;
  address: string;
  topicRanks: number[];
  menuLabels: string[];
  menuStatus: string;
  registryStatus: string;
  evidenceCount: number;
  publication: {
    restaurantId: string | null;
    publishedRanks: number[];
    reason: string;
  };
};
type Detail = Row & {
  historicalPrices: string[];
  menuClues: string[];
  registry: {
    id: string;
    name: string;
    roadAddress: string;
    parcelAddress: string;
    status: string;
    detail: string;
    closedAt: string;
    snapshotDate: string;
    url: string;
  }[];
  evidence: {
    topicRank: number;
    sourceUrl: string;
    sourceTitle: string;
    publishedAt: string;
    name: string;
    address: string;
    menuLabels: string[];
  }[];
  manualEvidence: {
    topicRank: number;
    sourceUrl: string;
    identitySourceUrl: string;
    address: string;
    chefName?: string;
    reviewNote?: string;
  }[];
};
type Result = {
  summary: {
    updatedAt: string;
    candidateRows: number;
    pendingCandidateRows: number;
    uniquePublishedRestaurants: number;
    sourceAssociations: number;
    topics: Topic[];
  };
  rows: Row[];
  total: number;
  page: number;
  pages: number;
};
const labels: Record<string, string> = {
  published: "주제 연결 완료",
  partly_published: "일부 주제 확인 필요",
  identity_review: "상호·주소 대조 필요",
  source_review: "소개 출처 대조 필요",
  operation_review: "영업·이전 확인 필요",
};
const registryLabels: Record<string, string> = {
  registry_active: "인허가상 영업 기록",
  registry_closed_at_address: "같은 주소에 폐업 기록",
  registry_active_with_closed_history: "영업·폐업 기록 혼재",
  floor_or_unit_conflict_review: "층·호수 충돌",
  no_registry_match: "인허가 일치 기록 없음",
  outside_seoul_or_address_incomplete: "인허가 대조 범위 밖 / 주소 부족",
};
const box = "rounded-2xl border border-[#e8e4e5] bg-white";
const control =
  "min-h-11 rounded-xl border border-[#ded9dc] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#ef6479]";
const count = (n: number) => n.toLocaleString("ko-KR");
function externalUrl(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : undefined;
  } catch {
    return undefined;
  }
}
function EvidenceLink({
  url,
  children,
}: {
  url: string;
  children: React.ReactNode;
}) {
  const href = externalUrl(url);
  return href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-sm font-semibold text-[#ad3f59] underline-offset-4 hover:underline"
    >
      {children}
      <ArrowUpRight size={14} className="shrink-0" />
    </a>
  ) : (
    <span>{children}</span>
  );
}

export default function AdminTopicResearch() {
  const { user, isLoggedIn } = useAuth();
  const allowed = isAdminUser(user);
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [topic, setTopic] = useState("0");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [detailError, setDetailError] = useState("");
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  const detailPanel = useRef<HTMLElement>(null);
  const adminKey = user ? getAdminRegistrationKey(user) : "";
  const token = user?.syncToken || "";
  useSeo({
    title: "신규 주제 · 조사 후보 검토",
    description: "맛픽 관리자 조사 후보 검토",
    path: "/admin/topic-research",
    robots: "noindex,nofollow",
  });
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);
  useEffect(() => {
    if (!allowed) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    setSelected(null);
    setDetail(null);
    const params = new URLSearchParams({
      scope: "topic-research",
      q: search,
      topic,
      status,
      page: String(page),
    });
    fetch(`/api/restaurants?${params}`, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "x-matpick-admin-key": adminKey,
        "x-matpick-admin-token": token,
      },
    })
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!controller.signal.aborted) setResult(body);
      })
      .catch(e => {
        if (!controller.signal.aborted)
          setError(e.message || "목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [allowed, adminKey, token, search, topic, status, page, retry]);
  useEffect(() => {
    if (!allowed || !selected) return;
    const controller = new AbortController();
    setDetail(null);
    setDetailError("");
    fetch(
      `/api/restaurants?scope=topic-research&id=${encodeURIComponent(selected)}`,
      {
        signal: controller.signal,
        cache: "no-store",
        headers: {
          "x-matpick-admin-key": adminKey,
          "x-matpick-admin-token": token,
        },
      }
    )
      .then(async response => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (!controller.signal.aborted) setDetail(body.row);
      })
      .catch(e => {
        if (!controller.signal.aborted)
          setDetailError(e.message || "상세 자료를 불러오지 못했습니다.");
      });
    detailPanel.current?.focus();
    return () => controller.abort();
  }, [selected, allowed, adminKey, token]);
  if (!allowed)
    return (
      <main className="mx-auto max-w-lg px-5 py-20">
        <Link href="/admin" className="text-sm text-[#ad3f59]">
          관리자 대시보드
        </Link>
        <h1 className="my-5 text-2xl font-black">관리자 로그인이 필요합니다</h1>
        <p className="mb-6 text-sm text-gray-600">
          관리자로 등록된 계정만 조사 후보와 미확인 자료를 볼 수 있습니다.
        </p>
        {!isLoggedIn && (
          <SocialLoginButtons redirectTo="/admin/topic-research" />
        )}
      </main>
    );
  const topics = result?.summary.topics || [];
  const topicName = (rank: number) =>
    topics.find(t => t.rank === rank)?.name || `주제 ${rank}`;
  return (
    <main className="min-h-screen bg-[#f7f6f8] px-4 py-7 text-[#28252b] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1480px]">
        <nav
          aria-label="관리자 메뉴"
          className="flex flex-wrap items-center gap-4 text-sm font-semibold text-[#716771]"
        >
          <Link
            href="/admin"
            className="inline-flex items-center gap-1 hover:text-[#ad3f59]"
          >
            <ArrowLeft size={16} />
            대시보드
          </Link>
          <Link href="/admin/restaurants" className="hover:text-[#ad3f59]">
            식당 · 메뉴 · 가격 관리
          </Link>
          <span aria-current="page" className="text-[#ad3f59]">
            신규 주제 검토
          </span>
        </nav>
        <header className="my-7">
          <p className="text-xs font-bold tracking-widest text-[#ad3f59]">
            MATPICK · CONTENT RESEARCH
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            새로운 맛집, 꼼꼼하게 확인하기
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[#746b75]">
            조사 후보를 주제별로 대조하는 공간입니다. 상호·주소·위치와 소개
            출처가 연결된 기존 식당만 공개하며, 후보 수에는 주제 간 중복이
            포함됩니다.
          </p>
        </header>
        {result && (
          <section
            aria-label="조사 현황"
            className="grid grid-cols-2 gap-3 xl:grid-cols-4"
          >
            {[
              [
                "전체 조사 후보",
                result.summary.candidateRows,
                "중복을 포함한 조사 행",
              ],
              [
                "검토 남은 후보",
                result.summary.pendingCandidateRows,
                "일부 주제만 연결된 후보 포함",
              ],
              [
                "주제 연결 식당",
                result.summary.uniquePublishedRestaurants,
                "기존 식당 · 신규 식당 추가 0곳",
              ],
              [
                "공개 소개 출처",
                result.summary.sourceAssociations,
                "식당과 새 주제의 연결 수",
              ],
            ].map(([label, value, note]) => (
              <div key={label} className={`${box} p-4 sm:p-5`}>
                <p className="text-xs font-semibold text-[#736b75]">{label}</p>
                <p className="mt-2 text-3xl font-black tabular-nums sm:text-4xl">
                  {count(Number(value))}
                </p>
                <p className="mt-2 text-[11px] leading-5 text-[#8a818b]">
                  {note}
                </p>
              </div>
            ))}
          </section>
        )}
        <section
          className={`${box} mt-6 p-4 sm:p-5`}
          aria-label="후보 검색과 필터"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative flex-1">
              <span className="sr-only">상호·주소·메뉴 검색</span>
              <Search
                size={18}
                className="absolute left-3 top-3 text-[#928993]"
              />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="상호, 주소, 메뉴로 검색"
                className={`${control} w-full pl-10`}
              />
            </label>
            <label>
              <span className="sr-only">검토 상태</span>
              <select
                className={`${control} w-full sm:w-56`}
                value={status}
                onChange={e => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
              >
                <option value="pending">검토 남은 후보</option>
                <option value="all">전체 후보</option>
                {Object.entries(labels).map(([key, value]) => (
                  <option value={key} key={key}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="주제 선택">
            {[
              {
                rank: 0,
                name: "전체 주제",
                candidateRows: result?.summary.candidateRows || 0,
              },
              ...topics,
            ].map(t => (
              <button
                key={t.rank}
                type="button"
                aria-pressed={topic === String(t.rank)}
                onClick={() => {
                  setTopic(String(t.rank));
                  setPage(1);
                }}
                className={`min-h-10 rounded-full px-3 py-2 text-xs font-semibold transition ${topic === String(t.rank) ? "bg-[#332932] text-white" : "bg-[#f5f3f5] text-[#766a76] hover:bg-[#fce8ef]"}`}
              >
                {t.name}
                <span className="ml-1.5 opacity-65">
                  {count(t.candidateRows)}
                </span>
              </button>
            ))}
          </div>
        </section>
        <div className="my-4 flex flex-wrap justify-between gap-2 text-xs text-[#766b77]">
          <p aria-live="polite">
            {loading
              ? "후보를 불러오고 있습니다…"
              : result
                ? `검색 결과 ${count(result.total)}건 · ${result.page} / ${result.pages}페이지`
                : "조사 자료 연결 중"}
          </p>
          <p>
            조사 기준 {result?.summary.updatedAt || "2026-09-22"} · 전수 검증
            진행 중
          </p>
        </div>
        {error && (
          <div role="alert" className={`${box} mb-4 p-5 text-sm text-red-700`}>
            {error}
            <button
              onClick={() => setRetry(n => n + 1)}
              className={`${control} ml-3`}
            >
              다시 불러오기
            </button>
          </div>
        )}
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(340px,.8fr)]">
          <section
            aria-label="조사 후보 목록"
            aria-busy={loading}
            className={`${box} overflow-hidden ${selected ? "hidden lg:block" : ""}`}
          >
            {!loading && !error && result?.rows.length === 0 && (
              <p className="p-10 text-center text-sm text-[#847984]">
                조건에 맞는 후보가 없습니다. 다른 주제나 검색어를 선택해 주세요.
              </p>
            )}
            {!error &&
              result?.rows.map(row => (
                <button
                  type="button"
                  key={row.id}
                  disabled={loading}
                  onClick={() => setSelected(row.id)}
                  aria-pressed={selected === row.id}
                  className={`block w-full border-b border-[#eee9ed] p-5 text-left transition hover:bg-[#fff7fa] disabled:opacity-50 ${selected === row.id ? "bg-[#fff1f6] shadow-[inset_3px_0_0_#ed6d8a]" : ""}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="text-base font-extrabold">
                      {row.name || "상호 미확인"}
                    </h2>
                    <span
                      className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold ${row.publication.reason === "published" ? "bg-emerald-50 text-emerald-700" : "bg-[#f2eef2] text-[#827484]"}`}
                    >
                      {labels[row.publication.reason]}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[#817581]">
                    {row.address || "주소 확인 필요"}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-[#ad3f59]">
                    {row.topicRanks.map(topicName).join(" · ")}
                  </p>
                  <p className="mt-3 truncate text-xs text-[#928892]">
                    {row.menuLabels.length
                      ? `메뉴 단서 · ${row.menuLabels.join(" / ")}`
                      : "메뉴 단서 없음"}{" "}
                    · 출처 {row.evidenceCount}건
                  </p>
                </button>
              ))}
            {result && (
              <nav
                aria-label="후보 페이지"
                className="flex items-center justify-between gap-3 p-4"
              >
                <button
                  className={`${control} inline-flex items-center gap-1 disabled:opacity-35`}
                  disabled={loading || result.page <= 1}
                  onClick={() => setPage(result.page - 1)}
                >
                  <ChevronLeft size={16} />
                  이전
                </button>
                <span className="text-xs tabular-nums">
                  {result.page} / {result.pages}
                </span>
                <button
                  className={`${control} inline-flex items-center gap-1 disabled:opacity-35`}
                  disabled={loading || result.page >= result.pages}
                  onClick={() => setPage(result.page + 1)}
                >
                  다음
                  <ChevronRight size={16} />
                </button>
              </nav>
            )}
          </section>
          <aside
            ref={detailPanel}
            tabIndex={-1}
            aria-label="선택한 후보 상세"
            className={`${box} p-5 outline-none sm:p-6 lg:sticky lg:top-5 lg:max-h-[90vh] lg:overflow-y-auto ${!selected ? "hidden lg:block" : ""}`}
          >
            {!selected ? (
              <div className="py-20 text-center">
                <Search size={28} className="mx-auto text-[#c2b5c2]" />
                <h2 className="mt-4 font-bold">
                  왼쪽에서 후보를 선택해 주세요
                </h2>
                <p className="mt-2 text-xs leading-6 text-[#877c88]">
                  상호·주소, 소개 근거, 메뉴 단서와
                  <br />
                  영업 기록을 함께 확인할 수 있습니다.
                </p>
              </div>
            ) : (
              <>
                <button
                  className="mb-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-[#887788]"
                  onClick={() => setSelected(null)}
                >
                  <X size={16} />
                  상세 닫기
                </button>
                {detailError && (
                  <p role="alert" className="text-sm text-red-700">
                    {detailError}
                    <button
                      className={`${control} ml-2`}
                      onClick={() => setSelected(null)}
                    >
                      목록으로
                    </button>
                  </p>
                )}
                {!detail && !detailError && (
                  <p role="status" className="py-12 text-sm text-[#847884]">
                    근거 자료를 불러오는 중…
                  </p>
                )}
                {detail && (
                  <>
                    <p className="text-xs font-bold text-[#ad3f59]">
                      {labels[detail.publication.reason]}
                    </p>
                    <h2 className="mt-2 break-words text-2xl font-black">
                      {detail.name}
                    </h2>
                    <p className="mt-3 text-sm leading-6 text-[#766876]">
                      {detail.address || "주소 미확인"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {detail.topicRanks.map(rank => (
                        <span
                          key={rank}
                          className="inline-flex items-center gap-1 rounded-lg bg-[#f7f2f6] px-2 py-1.5 text-xs"
                        >
                          {detail.publication.publishedRanks.includes(rank) && (
                            <Check size={12} className="text-emerald-600" />
                          )}
                          {topicName(rank)}
                        </span>
                      ))}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-4">
                      <EvidenceLink
                        url={`https://map.naver.com/p/search/${encodeURIComponent(`${detail.name} ${detail.address}`)}`}
                      >
                        네이버지도 대조
                      </EvidenceLink>
                      {detail.publication.restaurantId && (
                        <Link
                          className="text-sm font-bold text-[#ad3f59] underline"
                          href={`/admin/restaurants?restaurantId=${encodeURIComponent(detail.publication.restaurantId)}`}
                        >
                          기존 식당 편집
                        </Link>
                      )}
                    </div>
                    <section className="mt-7 border-t border-[#eee8ee] pt-5">
                      <h3 className="font-bold">메뉴 · 가격 단서</h3>
                      <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
                        소개 당시의 추출 자료입니다. 메뉴의 식당 귀속과 현재
                        가격 확인 전에는 공개 메뉴로 사용할 수 없습니다.
                      </p>
                      {detail.menuLabels.length ? (
                        <ul className="mt-3 space-y-2 text-sm leading-6">
                          {detail.menuLabels.map((menu, i) => (
                            <li className="break-words" key={i}>
                              {menu}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-3 text-sm text-[#8a7e8b]">
                          명시된 메뉴가 없습니다.
                        </p>
                      )}
                      {detail.historicalPrices.length > 0 && (
                        <p className="mt-3 text-xs leading-5 text-[#867887]">
                          과거 가격 단서: {detail.historicalPrices.join(" · ")}
                        </p>
                      )}
                    </section>
                    <section className="mt-6 border-t border-[#eee8ee] pt-5">
                      <h3 className="font-bold">영업 · 주소 대조</h3>
                      <p className="mt-2 text-sm text-[#7b6d7c]">
                        {registryLabels[detail.registryStatus] ||
                          "인허가 대조 필요"}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[#9a8c9b]">
                        서울 인허가 자료의 기록이며 현재 실제 영업을 보장하지
                        않습니다. 미일치는 폐업을 뜻하지 않습니다.
                      </p>
                      {detail.registry.map(r => (
                        <div
                          key={r.id}
                          className="mt-3 rounded-xl bg-[#f7f5f8] p-3 text-xs leading-6"
                        >
                          <p className="font-bold">
                            {r.name} · {r.status}
                          </p>
                          <p>{r.roadAddress || r.parcelAddress}</p>
                          <p>
                            자료 기준 {r.snapshotDate}
                            {r.closedAt && ` · 폐업 신고 ${r.closedAt}`}
                          </p>
                          <EvidenceLink url={r.url}>인허가 자료</EvidenceLink>
                        </div>
                      ))}
                    </section>
                    <section className="mt-6 border-t border-[#eee8ee] pt-5">
                      <h3 className="font-bold">
                        소개 근거 · {detail.evidence.length}건
                      </h3>
                      <p className="mt-2 text-xs leading-5 text-[#958695]">
                        각 링크의 해당 식당과 주소를 대조해 주세요. 자동 추출된
                        출처만으로 주제 연결이 확정되지는 않습니다.
                      </p>
                      {detail.manualEvidence.map((e, i) => (
                        <div
                          key={`manual-${i}`}
                          className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs leading-6"
                        >
                          <p className="font-bold">
                            별도 대조 · {topicName(e.topicRank)}
                          </p>
                          <p>
                            {e.address}
                            {e.chefName && ` · ${e.chefName} 셰프`}
                          </p>
                          <div className="flex flex-wrap gap-3">
                            <EvidenceLink url={e.sourceUrl}>
                              소개 근거
                            </EvidenceLink>
                            <EvidenceLink url={e.identitySourceUrl}>
                              상호·주소 근거
                            </EvidenceLink>
                          </div>
                        </div>
                      ))}
                      {detail.evidence.map((e, i) => (
                        <div
                          key={i}
                          className="mt-4 border-b border-[#f0eaf0] pb-4"
                        >
                          <p className="mb-2 text-[11px] font-bold text-[#928193]">
                            {topicName(e.topicRank)} ·{" "}
                            {e.publishedAt?.slice(0, 10) || "게시일 미확인"}
                          </p>
                          <EvidenceLink url={e.sourceUrl}>
                            {e.sourceTitle || "원문에서 소개 내용 확인"}
                          </EvidenceLink>
                          <p className="mt-2 text-xs leading-5 text-[#89798a]">
                            {e.name} {e.address}
                          </p>
                          {e.menuLabels.length > 0 && (
                            <p className="mt-1 break-words text-xs leading-5 text-[#89798a]">
                              {e.menuLabels.join(" / ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </section>
                  </>
                )}
              </>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
