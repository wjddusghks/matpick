import type { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, Home, MessageCircleMore, PlusCircle } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";
import { useAuth } from "@/contexts/AuthContext";
import { getDisplayName } from "@/lib/authProfile";
import matpickLogo from "@/assets/matpick-logo-final 2.png";

export default function CommunityShell({
  children,
  showBack = false,
}: {
  children: ReactNode;
  showBack?: boolean;
}) {
  const [location] = useLocation();
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-[#fffafa] text-[#1b1718]">
      <header className="sticky top-0 z-40 border-b border-[#f1e3e6] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            {showBack ? (
              <button
                type="button"
                onClick={() => window.history.back()}
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border border-[#f0dfe2] text-[#61585a] transition hover:border-[#ffb8c1] hover:text-[#ff6f7c]"
                aria-label="뒤로 가기"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            ) : null}
            <Link href="/" className="flex min-w-0 items-center gap-2 no-underline">
              <img src={matpickLogo} alt="맛픽" className="h-9 w-9 object-contain" />
              <div className="min-w-0">
                <p className="truncate text-[10px] font-bold uppercase tracking-[0.22em] text-[#ff7b83]">
                  Matpick Community
                </p>
                <p className="truncate text-base font-black">맛픽 라운지</p>
              </div>
            </Link>
          </div>

          <nav className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/community"
              className={`flex h-9 items-center rounded-full px-3 text-xs font-bold no-underline sm:px-4 ${
                location === "/community"
                  ? "bg-[#ff7b83] text-white"
                  : "bg-[#fff1f3] text-[#ff6575]"
              }`}
            >
              <MessageCircleMore className="mr-1.5 h-4 w-4" />
              라운지
            </Link>
            <Link
              href="/suggest"
              className={`hidden h-9 items-center rounded-full px-4 text-xs font-bold no-underline sm:flex ${
                location === "/suggest"
                  ? "bg-[#ff7b83] text-white"
                  : "border border-[#f0dfe2] bg-white text-[#554c4e]"
              }`}
            >
              <PlusCircle className="mr-1.5 h-4 w-4" />
              맛집 제보
            </Link>
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-[#f0dfe2] bg-white text-[#62595b] no-underline"
              aria-label="홈으로"
            >
              <Home className="h-4 w-4" />
            </Link>
            {user ? (
              <span className="hidden max-w-24 truncate text-xs font-semibold text-[#756b6d] md:inline">
                {getDisplayName(user)}
              </span>
            ) : null}
          </nav>
        </div>
      </header>
      {children}
      <SiteFooter />
    </div>
  );
}
