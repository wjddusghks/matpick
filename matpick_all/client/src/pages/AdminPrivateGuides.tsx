import { Link } from "wouter";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import PrivateGuides from "@/components/admin/PrivateGuides";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/admin";
import { useSeo } from "@/lib/seo";

export default function AdminPrivateGuides() {
  const { user, isLoggedIn } = useAuth();
  useSeo({ title: "관리자 전용 지역 가이드", description: "맛픽 비공개 자료실", path: "/admin/private-guides", robots: "noindex,nofollow" });
  return <main className="min-h-screen bg-[#f8f5f6] px-4 py-8 text-[#342c30] sm:px-8">
    <div className="mx-auto max-w-4xl">
      <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[#896a75]"><ArrowLeft size={16}/> 대시보드</Link>
      {isAdminUser(user) ? <div className="mt-5"><PrivateGuides /></div> : <section className="mt-8 rounded-3xl border bg-white p-8">
        <LockKeyhole className="text-[#b7233b]"/>
        <h1 className="mt-4 text-2xl font-black">관리자 로그인이 필요합니다</h1>
        <p className="my-5 text-sm text-[#86707a]">권한이 있는 계정으로 로그인하면 비공개 지역 가이드를 볼 수 있습니다.</p>
        {!isLoggedIn && <SocialLoginButtons redirectTo="/admin/private-guides"/>}
      </section>}
    </div>
  </main>;
}
