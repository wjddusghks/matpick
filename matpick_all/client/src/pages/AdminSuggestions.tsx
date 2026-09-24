import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { SuggestionInboxPanel } from "@/components/admin/SuggestionInboxPanel";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/admin";
import { useSuggestionInbox } from "@/lib/useSuggestionInbox";
import { useSeo } from "@/lib/seo";

export default function AdminSuggestions() {
  const { user, isLoggedIn } = useAuth();
  const inbox = useSuggestionInbox();
  useSeo({
    title: "사용자 맛집 제보함",
    description: "사용자가 알려준 식당 정보를 검토합니다.",
    path: "/admin/suggestions",
    robots: "noindex,nofollow",
  });
  if (!isLoggedIn || !user || !isAdminUser(user))
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
    <main className="si-page">
      <div className="si-page-inner">
        <Link href="/admin" className="si-back">
          <ArrowLeft size={16} />
          관리자 대시보드
        </Link>
        <SuggestionInboxPanel {...inbox} />
      </div>
    </main>
  );
}
