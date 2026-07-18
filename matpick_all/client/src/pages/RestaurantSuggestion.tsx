import { useEffect, useState, type FormEvent } from "react";
import { CheckCircle2, Clock3, MapPin, Store } from "lucide-react";
import { toast } from "sonner";
import CommunityShell from "@/components/community/CommunityShell";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import {
  createRestaurantSuggestion,
  fetchMyRestaurantSuggestions,
  formatCommunityDate,
  type RestaurantSuggestion as RestaurantSuggestionType,
} from "@/lib/community";
import { useSeo } from "@/lib/seo";

const emptyDraft = { name: "", address: "", region: "", category: "", mapUrl: "", reason: "" };

const statusLabels: Record<RestaurantSuggestionType["status"], string> = {
  pending: "검토 중",
  published: "회원 추천",
  merged: "공식 식당 반영",
  rejected: "보류",
};

export default function RestaurantSuggestion() {
  const { user, isLoggedIn } = useAuth();
  const [draft, setDraft] = useState(emptyDraft);
  const [mine, setMine] = useState<RestaurantSuggestionType[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingMine, setIsLoadingMine] = useState(false);

  useSeo({
    title: "맛집 제보 | 맛픽",
    description: "맛픽 회원이 직접 새로운 식당을 추천하고 등록 상태를 확인합니다.",
    path: "/suggest",
  });

  useEffect(() => {
    if (!user?.syncToken) {
      setMine([]);
      return;
    }
    setIsLoadingMine(true);
    void fetchMyRestaurantSuggestions(user)
      .then(setMine)
      .catch(() => setMine([]))
      .finally(() => setIsLoadingMine(false));
  }, [user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim() || !draft.address.trim()) {
      toast.error("식당명과 주소를 입력해 주세요.");
      return;
    }
    setIsSubmitting(true);
    try {
      const suggestion = await createRestaurantSuggestion(user, draft);
      setMine((current) => [suggestion, ...current]);
      setDraft(emptyDraft);
      toast.success("맛집 제보를 접수했어요.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "맛집을 제보하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CommunityShell showBack>
      <main className="mx-auto max-w-[1050px] px-4 py-8 sm:px-6 sm:py-12">
        <section className="rounded-[30px] bg-[linear-gradient(135deg,#2b2526_0%,#4a3438_100%)] p-6 text-white sm:p-9">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10"><Store className="h-6 w-6 text-[#ff9aa7]" /></div>
          <h1 className="mt-5 text-3xl font-black tracking-[-0.04em] sm:text-4xl">내가 아는 맛집을 맛픽에 알려주세요.</h1>
          <p className="mt-3 max-w-2xl break-keep text-sm leading-7 text-white/65">기존 맛픽 데이터와 중복 여부를 확인한 뒤 회원 추천 식당으로 공개하고, 검증이 끝나면 공식 식당 데이터와 연결합니다.</p>
        </section>

        {!isLoggedIn || !user?.syncToken ? (
          <section className="mt-6 rounded-[28px] border border-[#eee0e3] bg-white p-7 text-center sm:p-10">
            <MapPin className="mx-auto h-8 w-8 text-[#ff7483]" />
            <h2 className="mt-4 text-xl font-black">회원만 맛집을 제보할 수 있어요.</h2>
            <p className="mt-2 text-sm leading-6 text-[#817678]">로그인하면 제보한 식당의 검토 상태도 계속 확인할 수 있습니다.</p>
            <SocialLoginButtons redirectTo="/suggest" className="mx-auto mt-6 max-w-sm" />
          </section>
        ) : (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <form onSubmit={handleSubmit} className="rounded-[28px] border border-[#eee0e3] bg-white p-5 sm:p-7">
              <h2 className="text-lg font-black">새 식당 제보</h2>
              <p className="mt-2 text-xs leading-5 text-[#8e8385]">정확한 식당명과 주소를 입력하면 확인이 훨씬 빨라져요.</p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">식당명 *<input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} maxLength={100} placeholder="예: 맛픽식당" className="mt-2 h-12 w-full rounded-2xl border border-[#eadde0] px-4 font-normal outline-none focus:border-[#ff9daa]" /></label>
                <label className="text-sm font-bold">주소 *<input value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} maxLength={240} placeholder="도로명 또는 지번 주소" className="mt-2 h-12 w-full rounded-2xl border border-[#eadde0] px-4 font-normal outline-none focus:border-[#ff9daa]" /></label>
                <label className="text-sm font-bold">지역<input value={draft.region} onChange={(event) => setDraft((current) => ({ ...current, region: event.target.value }))} maxLength={80} placeholder="예: 서울 성수동" className="mt-2 h-12 w-full rounded-2xl border border-[#eadde0] px-4 font-normal outline-none focus:border-[#ff9daa]" /></label>
                <label className="text-sm font-bold">음식 종류<input value={draft.category} onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} maxLength={80} placeholder="예: 한식, 이탈리안" className="mt-2 h-12 w-full rounded-2xl border border-[#eadde0] px-4 font-normal outline-none focus:border-[#ff9daa]" /></label>
                <label className="text-sm font-bold sm:col-span-2">지도 링크<input value={draft.mapUrl} onChange={(event) => setDraft((current) => ({ ...current, mapUrl: event.target.value }))} maxLength={600} placeholder="네이버 지도 또는 카카오맵 링크 (선택)" className="mt-2 h-12 w-full rounded-2xl border border-[#eadde0] px-4 font-normal outline-none focus:border-[#ff9daa]" /></label>
                <label className="text-sm font-bold sm:col-span-2">추천 이유<textarea value={draft.reason} onChange={(event) => setDraft((current) => ({ ...current, reason: event.target.value }))} maxLength={1500} rows={5} placeholder="추천 메뉴와 이 식당을 소개하고 싶은 이유를 적어주세요." className="mt-2 w-full resize-y rounded-2xl border border-[#eadde0] px-4 py-3 font-normal leading-6 outline-none focus:border-[#ff9daa]" /></label>
              </div>
              <button type="submit" disabled={isSubmitting || !draft.name.trim() || !draft.address.trim()} className="mt-5 h-12 w-full rounded-full bg-[#ff7483] text-sm font-black text-white shadow-[0_12px_28px_rgba(255,116,131,0.24)] disabled:opacity-40">{isSubmitting ? "접수 중..." : "맛집 제보하기"}</button>
            </form>

            <aside className="rounded-[28px] border border-[#eee0e3] bg-white p-5 sm:p-6 lg:h-fit">
              <div className="flex items-center justify-between"><h2 className="text-base font-black">내가 제보한 식당</h2><span className="rounded-full bg-[#fff0f2] px-2.5 py-1 text-xs font-black text-[#ff6575]">{mine.length}</span></div>
              <div className="mt-4 space-y-3">
                {isLoadingMine ? <p className="py-6 text-center text-xs text-[#9a8f91]">불러오는 중...</p> : null}
                {!isLoadingMine && mine.length === 0 ? <p className="rounded-[18px] border border-dashed border-[#eadde0] px-4 py-7 text-center text-xs leading-5 text-[#9a8f91]">아직 제보한 식당이 없어요.</p> : null}
                {mine.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-[#f0e4e6] p-4">
                    <div className="flex items-start justify-between gap-2"><p className="text-sm font-black">{item.name}</p><span className={`flex-shrink-0 rounded-full px-2 py-1 text-[10px] font-black ${item.status === "merged" ? "bg-[#e9f8ef] text-[#26864a]" : "bg-[#fff2e5] text-[#c47722]"}`}>{statusLabels[item.status]}</span></div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#8e8385]">{item.address}</p>
                    <p className="mt-2 flex items-center text-[11px] text-[#aaa0a2]">{item.status === "merged" ? <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> : <Clock3 className="mr-1 h-3.5 w-3.5" />}{formatCommunityDate(item.createdAt)}</p>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        )}
      </main>
    </CommunityShell>
  );
}
