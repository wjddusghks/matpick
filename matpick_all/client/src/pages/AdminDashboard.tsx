import {
  ArrowLeft,
  BarChart3,
  Clock3,
  Database,
  Eye,
  LayoutDashboard,
  LockKeyhole,
  Megaphone,
  MapPin,
  MousePointerClick,
  Search,
  ShieldCheck,
  Store,
  Tags,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import {
  discoveryTopics,
  publicDiscoveryTopics,
  restaurants,
  searchData,
  sources,
  visits,
} from "@/data";
import { featuredMapCollections } from "@/data/mapCollections";
import { getAdminRegistrationKey, hasAdminConfiguration, isAdminUser } from "@/lib/admin";
import { getDisplayName } from "@/lib/authProfile";
import { useSeo } from "@/lib/seo";

const cardClass =
  "rounded-[8px] border border-[#eadfe2] bg-white px-5 py-4 shadow-[0_12px_32px_rgba(27,20,22,0.05)]";

type AnalyticsEntry = {
  label: string;
  count: number;
};

type AnalyticsSummary = {
  day: string;
  storage: "kv" | "memory";
  counts: {
    visitors: number;
    sessions: number;
    pageViews: number;
    avgDurationSeconds: number;
    mapClicks: number;
    searches: number;
    adImpressions: number;
    adClicks: number;
    coupangImpressions: number;
    coupangClicks: number;
    adfitImpressions: number;
    adfitClicks: number;
    adsenseImpressions: number;
    adsenseClicks: number;
  };
  topPages: AnalyticsEntry[];
  topSearches: AnalyticsEntry[];
  topEvents: AnalyticsEntry[];
  topClicks: AnalyticsEntry[];
};

const emptyAnalyticsSummary: AnalyticsSummary = {
  day: "",
  storage: "memory",
  counts: {
    visitors: 0,
    sessions: 0,
    pageViews: 0,
    avgDurationSeconds: 0,
    mapClicks: 0,
    searches: 0,
    adImpressions: 0,
    adClicks: 0,
    coupangImpressions: 0,
    coupangClicks: 0,
    adfitImpressions: 0,
    adfitClicks: 0,
    adsenseImpressions: 0,
    adsenseClicks: 0,
  },
  topPages: [],
  topSearches: [],
  topEvents: [],
  topClicks: [],
};

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "0초";
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  if (minutes <= 0) {
    return `${remainder}초`;
  }

  return `${minutes}분 ${remainder}초`;
}

function formatMetricDate(day: string) {
  if (!day) {
    return "오늘";
  }

  return day.replace(/-/g, ".");
}

function formatStorageLabel(storage: AnalyticsSummary["storage"]) {
  return storage === "kv" ? "KV 누적" : "임시 메모리";
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number | string;
  description: string;
  icon: ReactNode;
}) {
  return (
    <section className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#8a747a]">{label}</p>
          <p className="mt-2 text-3xl font-black text-[#171717]">
            {typeof value === "number" ? formatNumber(value) : value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#fff0f3] text-[#ff6b7b]">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#6d6265]">{description}</p>
    </section>
  );
}

function MetricList({
  title,
  description,
  entries,
}: {
  title: string;
  description: string;
  entries: AnalyticsEntry[];
}) {
  return (
    <section className={cardClass}>
      <h2 className="text-lg font-black text-[#171717]">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-[#6d6265]">{description}</p>
      <div className="mt-4 space-y-3">
        {entries.length > 0 ? (
          entries.map((entry, index) => (
            <div
              key={`${entry.label}-${index}`}
              className="flex items-center justify-between gap-4 border-b border-[#f1e4e7] pb-3 last:border-b-0 last:pb-0"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-[#6d6265]">
                {entry.label}
              </span>
              <span className="shrink-0 text-sm font-black text-[#171717]">
                {formatNumber(entry.count)}
              </span>
            </div>
          ))
        ) : (
          <p className="rounded-[8px] bg-[#fff8f9] px-4 py-3 text-sm font-semibold text-[#8a747a]">
            아직 집계된 데이터가 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}

function AccessShell({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#fff8f9] px-4 py-8 text-[#171717] sm:px-8">
      <div className="mx-auto max-w-[760px]">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-bold text-[#ff6b7b]"
        >
          <ArrowLeft className="h-4 w-4" />
          홈으로 돌아가기
        </Link>
        <section className="mt-8 rounded-[8px] border border-[#eadfe2] bg-white px-6 py-8 shadow-[0_18px_48px_rgba(27,20,22,0.06)]">
          <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-[#fff0f3] text-[#ff6b7b]">
            <LockKeyhole className="h-6 w-6" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-[#171717]">{title}</h1>
          <p className="mt-3 break-keep text-sm leading-6 text-[#6d6265]">
            {description}
          </p>
          <div className="mt-6">{children}</div>
        </section>
      </div>
    </main>
  );
}

export default function AdminDashboard() {
  const { isLoggedIn, user } = useAuth();
  const isAdmin = isAdminUser(user);
  const [analyticsSummary, setAnalyticsSummary] =
    useState<AnalyticsSummary>(emptyAnalyticsSummary);
  const [analyticsStatus, setAnalyticsStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle"
  );
  const [analyticsError, setAnalyticsError] = useState("");
  const restaurantsWithCoordinates = restaurants.filter(
    (restaurant) => restaurant.lat && restaurant.lng
  ).length;
  const restaurantsWithPhotos = restaurants.filter((restaurant) =>
    restaurant.imageUrl?.trim()
  ).length;
  const restaurantsWithMenus = restaurants.filter(
    (restaurant) => (restaurant.menus?.length ?? 0) > 0
  ).length;
  const menuCount = restaurants.reduce(
    (sum, restaurant) => sum + (restaurant.menus?.length ?? 0),
    0
  );
  const analyticsCounts = analyticsSummary.counts;

  useEffect(() => {
    if (!isLoggedIn || !user || !isAdmin) {
      return;
    }

    const controller = new AbortController();
    setAnalyticsStatus("loading");
    setAnalyticsError("");

    fetch("/api/admin/metrics", {
      headers: {
        "x-matpick-admin-key": getAdminRegistrationKey(user),
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(payload?.error || "운영 지표를 불러오지 못했습니다.");
        }
        return response.json() as Promise<{ summary?: AnalyticsSummary }>;
      })
      .then((payload) => {
        if (payload.summary) {
          setAnalyticsSummary(payload.summary);
        }
        setAnalyticsStatus("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return;
        }
        setAnalyticsStatus("error");
        setAnalyticsError(
          error instanceof Error ? error.message : "운영 지표를 불러오지 못했습니다."
        );
      });

    return () => controller.abort();
  }, [isAdmin, isLoggedIn, user]);

  useSeo({
    title: "관리자 대시보드",
    description: "맛픽 관리자 전용 데이터 현황 대시보드입니다.",
    path: "/admin",
    robots: "noindex,nofollow",
  });

  if (!isLoggedIn || !user) {
    return (
      <AccessShell
        title="관리자 로그인이 필요합니다"
        description="관리자 대시보드는 카카오 또는 네이버로 로그인한 뒤, 관리자 허용 목록에 등록된 계정만 접근할 수 있습니다."
      >
        <SocialLoginButtons redirectTo="/admin" />
      </AccessShell>
    );
  }

  if (!isAdmin) {
    return (
      <AccessShell
        title="관리자 권한이 없습니다"
        description="현재 로그인한 계정은 관리자 허용 목록에 등록되어 있지 않습니다. 아래 계정 키를 Vercel 환경변수 VITE_ADMIN_USER_IDS에 등록하면 이 계정으로 대시보드에 접근할 수 있습니다."
      >
        <div className="rounded-[8px] border border-[#ffe0e5] bg-[#fff8f9] px-4 py-3">
          <p className="text-xs font-bold text-[#8a747a]">관리자 등록용 계정 키</p>
          <p className="mt-2 break-all font-mono text-sm font-bold text-[#171717]">
            {getAdminRegistrationKey(user)}
          </p>
          {user.email ? (
            <p className="mt-2 break-all text-xs font-semibold text-[#8a747a]">
              이메일: {user.email}
            </p>
          ) : null}
        </div>
      </AccessShell>
    );
  }

  return (
    <main className="min-h-screen bg-[#fff8f9] px-4 py-8 text-[#171717] sm:px-8">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-[#ff6b7b]"
          >
            <ArrowLeft className="h-4 w-4" />
            홈으로 돌아가기
          </Link>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#ffd5db] bg-white px-4 py-2 text-xs font-bold text-[#6d6265]">
            <ShieldCheck className="h-4 w-4 text-[#ff6b7b]" />
            {getDisplayName(user)} · {getAdminRegistrationKey(user)}
          </div>
        </div>

        <header className="mt-8">
          <p className="inline-flex items-center gap-2 text-sm font-black text-[#ff6b7b]">
            <LayoutDashboard className="h-4 w-4" />
            ADMIN
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-normal text-[#171717] sm:text-4xl">
            맛픽 관리자 대시보드
          </h1>
          <p className="mt-3 max-w-[760px] break-keep text-sm leading-6 text-[#6d6265]">
            데이터 투입 전에 식당, 주제, 출처, 검색 데이터의 현재 규모와 누락 상태를 빠르게 확인하는 운영 화면입니다.
          </p>
        </header>

        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-[#ff6b7b]">TODAY</p>
              <h2 className="mt-2 text-2xl font-black text-[#171717]">
                오늘 운영 지표
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#6d6265]">
                {formatMetricDate(analyticsSummary.day)} 기준 ·{" "}
                {formatStorageLabel(analyticsSummary.storage)}
                {analyticsStatus === "loading" ? " · 불러오는 중" : ""}
              </p>
            </div>
            {analyticsError ? (
              <p className="rounded-full border border-[#ffd5db] bg-white px-4 py-2 text-xs font-bold text-[#ff5f70]">
                {analyticsError}
              </p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="오늘 방문자"
              value={analyticsCounts.visitors}
              description={`세션 ${formatNumber(analyticsCounts.sessions)}회`}
              icon={<Eye className="h-5 w-5" />}
            />
            <StatCard
              label="페이지뷰"
              value={analyticsCounts.pageViews}
              description="오늘 열린 전체 페이지 수"
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <StatCard
              label="평균 체류시간"
              value={formatDuration(analyticsCounts.avgDurationSeconds)}
              description="페이지별 체류 이벤트 평균"
              icon={<Clock3 className="h-5 w-5" />}
            />
            <StatCard
              label="지도 보기 클릭"
              value={analyticsCounts.mapClicks}
              description="지도 이동/길찾기 관련 클릭"
              icon={<MapPin className="h-5 w-5" />}
            />
            <StatCard
              label="검색 실행"
              value={analyticsCounts.searches}
              description="메인 검색 제출 기준"
              icon={<Search className="h-5 w-5" />}
            />
            <StatCard
              label="광고 노출"
              value={analyticsCounts.adImpressions}
              description="맛픽 광고 슬롯 렌더링 기준"
              icon={<Megaphone className="h-5 w-5" />}
            />
            <StatCard
              label="광고 클릭"
              value={analyticsCounts.adClicks}
              description="추적 가능한 제휴 링크 클릭"
              icon={<MousePointerClick className="h-5 w-5" />}
            />
            <StatCard
              label="쿠팡 클릭"
              value={analyticsCounts.coupangClicks}
              description={`쿠팡 노출 ${formatNumber(analyticsCounts.coupangImpressions)}회`}
              icon={<MousePointerClick className="h-5 w-5" />}
            />
          </div>
        </section>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="식당 데이터"
            value={restaurants.length}
            description={`좌표 등록 ${formatNumber(restaurantsWithCoordinates)}곳`}
            icon={<Store className="h-5 w-5" />}
          />
          <StatCard
            label="메뉴 데이터"
            value={menuCount}
            description={`메뉴 보유 식당 ${formatNumber(restaurantsWithMenus)}곳`}
            icon={<Database className="h-5 w-5" />}
          />
          <StatCard
            label="공개 주제"
            value={publicDiscoveryTopics.length}
            description={`전체 주제 ${formatNumber(discoveryTopics.length)}개`}
            icon={<Tags className="h-5 w-5" />}
          />
          <StatCard
            label="지도 카드"
            value={featuredMapCollections.length}
            description={`검색 인덱스 ${formatNumber(searchData.length)}개`}
            icon={<MapPin className="h-5 w-5" />}
          />
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
          <section className={cardClass}>
            <h2 className="text-lg font-black text-[#171717]">데이터 품질 체크</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-4 border-b border-[#f1e4e7] pb-3">
                <span className="font-semibold text-[#6d6265]">사진 보유 식당</span>
                <span className="font-black text-[#171717]">
                  {formatNumber(restaurantsWithPhotos)} / {formatNumber(restaurants.length)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1e4e7] pb-3">
                <span className="font-semibold text-[#6d6265]">좌표 누락 식당</span>
                <span className="font-black text-[#171717]">
                  {formatNumber(restaurants.length - restaurantsWithCoordinates)}
                </span>
              </div>
              <div className="flex justify-between gap-4 border-b border-[#f1e4e7] pb-3">
                <span className="font-semibold text-[#6d6265]">메뉴 누락 식당</span>
                <span className="font-black text-[#171717]">
                  {formatNumber(restaurants.length - restaurantsWithMenus)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="font-semibold text-[#6d6265]">출처 데이터</span>
                <span className="font-black text-[#171717]">
                  {formatNumber(sources.length)}개 · 방문 {formatNumber(visits.length)}건
                </span>
              </div>
            </div>
          </section>

          <section className={cardClass}>
            <h2 className="text-lg font-black text-[#171717]">운영 설정</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="rounded-[8px] bg-[#fff8f9] px-4 py-3">
                <p className="font-bold text-[#6d6265]">관리자 허용 목록</p>
                <p className="mt-1 text-sm font-black text-[#171717]">
                  {hasAdminConfiguration() ? "설정됨" : "미설정"}
                </p>
              </div>
              <div className="rounded-[8px] bg-[#fff8f9] px-4 py-3">
                <p className="font-bold text-[#6d6265]">등록용 계정 키</p>
                <p className="mt-1 break-all font-mono text-sm font-black text-[#171717]">
                  {getAdminRegistrationKey(user)}
                </p>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-6 grid gap-4 lg:grid-cols-4">
          <MetricList
            title="인기 페이지"
            description="오늘 가장 많이 열린 URL입니다."
            entries={analyticsSummary.topPages}
          />
          <MetricList
            title="검색어"
            description="메인 검색에서 제출된 검색어입니다."
            entries={analyticsSummary.topSearches}
          />
          <MetricList
            title="주요 행동"
            description="검색, 카드, 지도, 리뷰 등 내부 이벤트입니다."
            entries={analyticsSummary.topEvents}
          />
          <MetricList
            title="클릭 위치"
            description="지도와 광고 클릭이 많이 발생한 위치입니다."
            entries={analyticsSummary.topClicks}
          />
        </div>

        <section className={`${cardClass} mt-6`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-black text-[#171717]">광고 수익 연동 상태</h2>
              <p className="mt-2 max-w-[760px] break-keep text-sm leading-6 text-[#6d6265]">
                애드핏과 쿠팡의 실제 수익 금액은 아직 자동 API 연동 전입니다. 지금은
                노출과 클릭을 먼저 모아두고, 수익 데이터는 추후 API 또는 수동 입력
                방식으로 붙일 수 있게 운영 지표 자리를 마련했습니다.
              </p>
            </div>
            <div className="grid min-w-[240px] gap-2 text-sm">
              <div className="flex justify-between gap-4 rounded-[8px] bg-[#fff8f9] px-4 py-3">
                <span className="font-bold text-[#6d6265]">애드핏 노출</span>
                <span className="font-black text-[#171717]">
                  {formatNumber(analyticsCounts.adfitImpressions)}
                </span>
              </div>
              <div className="flex justify-between gap-4 rounded-[8px] bg-[#fff8f9] px-4 py-3">
                <span className="font-bold text-[#6d6265]">쿠팡 노출</span>
                <span className="font-black text-[#171717]">
                  {formatNumber(analyticsCounts.coupangImpressions)}
                </span>
              </div>
              <div className="flex justify-between gap-4 rounded-[8px] bg-[#fff8f9] px-4 py-3">
                <span className="font-bold text-[#6d6265]">쿠팡 클릭</span>
                <span className="font-black text-[#171717]">
                  {formatNumber(analyticsCounts.coupangClicks)}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
