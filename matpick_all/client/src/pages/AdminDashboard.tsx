import {
  ArrowLeft,
  Database,
  LayoutDashboard,
  LockKeyhole,
  MapPin,
  ShieldCheck,
  Store,
  Tags,
} from "lucide-react";
import type { ReactNode } from "react";
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

function formatNumber(value: number) {
  return value.toLocaleString("ko-KR");
}

function StatCard({
  label,
  value,
  description,
  icon,
}: {
  label: string;
  value: number;
  description: string;
  icon: ReactNode;
}) {
  return (
    <section className={cardClass}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#8a747a]">{label}</p>
          <p className="mt-2 text-3xl font-black text-[#171717]">{formatNumber(value)}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-[#fff0f3] text-[#ff6b7b]">
          {icon}
        </div>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#6d6265]">{description}</p>
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
      </div>
    </main>
  );
}
