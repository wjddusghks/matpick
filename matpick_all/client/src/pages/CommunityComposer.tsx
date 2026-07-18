import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation } from "wouter";
import { Check, MapPin, Plus, Search, Store, X } from "lucide-react";
import { toast } from "sonner";
import CommunityShell from "@/components/community/CommunityShell";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import { restaurants } from "@/data";
import {
  communityCategories,
  createCommunityPost,
  createRestaurantSuggestion,
  fetchRestaurantSuggestions,
  type CommunityCategory,
  type PlaceTag,
  type RestaurantSuggestion,
} from "@/lib/community";
import { useSeo } from "@/lib/seo";

function toSuggestionTag(item: RestaurantSuggestion): PlaceTag {
  return {
    kind: "suggestion",
    id: item.id,
    name: item.name,
    address: item.address,
    category: item.category,
    region: item.region,
  };
}

export default function CommunityComposer() {
  const { user, isLoggedIn } = useAuth();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<CommunityCategory>("discussion");
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeTags, setPlaceTags] = useState<PlaceTag[]>([]);
  const [suggestions, setSuggestions] = useState<RestaurantSuggestion[]>([]);
  const [showNewPlace, setShowNewPlace] = useState(false);
  const [newPlace, setNewPlace] = useState({ name: "", address: "", region: "", category: "", mapUrl: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useSeo({
    title: "이야기 쓰기 | 맛픽 라운지",
    description: "맛집을 태그하고 추천, 질문, 토론 글을 작성합니다.",
    path: "/community/new",
    robots: "noindex,nofollow",
  });

  useEffect(() => {
    void fetchRestaurantSuggestions(100).then(setSuggestions).catch(() => setSuggestions([]));
  }, []);

  useEffect(() => {
    const restaurantId = new URLSearchParams(window.location.search).get("restaurantId");
    if (!restaurantId) return;
    const restaurant = restaurants.find((item) => item.id === restaurantId);
    if (!restaurant) return;
    setPlaceTags([{
      kind: "official",
      id: restaurant.id,
      name: restaurant.name,
      address: restaurant.address,
      category: restaurant.category,
      region: restaurant.region,
    }]);
  }, []);

  const searchResults = useMemo(() => {
    const normalized = placeQuery.replace(/\s+/g, "").toLocaleLowerCase("ko-KR");
    if (!normalized) return [];
    const official = restaurants
      .filter((restaurant) =>
        [restaurant.name, restaurant.address, restaurant.category]
          .join(" ")
          .replace(/\s+/g, "")
          .toLocaleLowerCase("ko-KR")
          .includes(normalized)
      )
      .slice(0, 6)
      .map<PlaceTag>((restaurant) => ({
        kind: "official",
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        category: restaurant.category,
        region: restaurant.region,
      }));
    const member = suggestions
      .filter((item) =>
        [item.name, item.address, item.category]
          .join(" ")
          .replace(/\s+/g, "")
          .toLocaleLowerCase("ko-KR")
          .includes(normalized)
      )
      .slice(0, 4)
      .map(toSuggestionTag);
    return [...official, ...member].filter(
      (item) => !placeTags.some((tag) => tag.kind === item.kind && tag.id === item.id)
    );
  }, [placeQuery, placeTags, suggestions]);

  const addTag = (tag: PlaceTag) => {
    if (placeTags.length >= 3) {
      toast.message("식당은 한 글에 최대 3곳까지 태그할 수 있어요.");
      return;
    }
    setPlaceTags((current) => [...current, tag]);
    setPlaceQuery("");
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("제목과 내용을 입력해 주세요.");
      return;
    }
    if (showNewPlace && newPlace.name.trim() && !newPlace.address.trim()) {
      toast.error("새 식당의 주소를 입력해 주세요.");
      return;
    }
    if (showNewPlace && newPlace.name.trim() && placeTags.length >= 3) {
      toast.error("새 식당을 연결하려면 기존 태그를 한 곳 이상 빼 주세요.");
      return;
    }

    setIsSubmitting(true);
    try {
      let nextTags = placeTags;
      if (showNewPlace && newPlace.name.trim()) {
        let suggestion: RestaurantSuggestion;
        try {
          suggestion = await createRestaurantSuggestion(user, {
            ...newPlace,
            reason: `${title.trim()} 글에서 함께 추천한 식당입니다.`,
          });
        } catch (error) {
          const duplicate = (error as Error & { suggestion?: RestaurantSuggestion }).suggestion;
          if (!duplicate) throw error;
          suggestion = duplicate;
        }
        if (!nextTags.some((tag) => tag.kind === "suggestion" && tag.id === suggestion.id)) {
          nextTags = [...nextTags, toSuggestionTag(suggestion)].slice(0, 3);
        }
      }

      const post = await createCommunityPost(user, {
        title: title.trim(),
        body: body.trim(),
        category,
        placeTags: nextTags,
      });
      toast.success("맛픽 라운지에 글을 등록했어요.");
      navigate(`/community/post/${post.id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "글을 등록하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isLoggedIn || !user?.syncToken) {
    return (
      <CommunityShell showBack>
        <main className="mx-auto max-w-[720px] px-4 py-16 sm:px-6">
          <section className="rounded-[30px] border border-[#f0dfe2] bg-white p-7 text-center shadow-[0_18px_50px_rgba(47,29,34,0.07)] sm:p-10">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#fff0f2] text-[#ff7483]">
              <Store className="h-6 w-6" />
            </div>
            <h1 className="mt-5 text-2xl font-black">로그인하고 이야기를 시작해 주세요.</h1>
            <p className="mt-3 break-keep text-sm leading-6 text-[#7d7274]">회원만 글을 작성할 수 있어요. 로그인 후 지금 보던 작성 화면으로 바로 돌아옵니다.</p>
            <SocialLoginButtons redirectTo="/community/new" className="mx-auto mt-6 max-w-sm" />
          </section>
        </main>
      </CommunityShell>
    );
  }

  return (
    <CommunityShell showBack>
      <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-7">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ff7483]">New story</p>
          <h1 className="mt-2 text-3xl font-black tracking-[-0.04em]">맛집 이야기를 들려주세요.</h1>
          <p className="mt-3 text-sm leading-6 text-[#807577]">식당 태그는 선택사항입니다. 아무 식당도 연결하지 않고 자유롭게 이야기해도 좋아요.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <section className="rounded-[26px] border border-[#eee0e3] bg-white p-5 sm:p-7">
            <label className="text-sm font-black">글 종류</label>
            <div className="mt-3 flex flex-wrap gap-2">
              {communityCategories.filter((item) => item.key !== "all").map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategory(item.key as CommunityCategory)}
                  className={`rounded-full px-4 py-2 text-sm font-bold ${category === item.key ? "bg-[#ff7483] text-white" : "border border-[#eadde0] text-[#716769]"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="mt-6 block text-sm font-black" htmlFor="community-title">제목</label>
            <input
              id="community-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={100}
              placeholder="어떤 이야기를 나누고 싶나요?"
              className="mt-2 h-13 w-full rounded-2xl border border-[#eadde0] px-4 text-sm outline-none focus:border-[#ff9daa] focus:ring-4 focus:ring-[#fff0f2]"
            />
            <label className="mt-5 block text-sm font-black" htmlFor="community-body">내용</label>
            <textarea
              id="community-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={5000}
              rows={9}
              placeholder="추천 이유, 궁금한 점, 방문 경험 등을 자유롭게 적어주세요."
              className="mt-2 w-full resize-y rounded-2xl border border-[#eadde0] px-4 py-3 text-sm leading-6 outline-none focus:border-[#ff9daa] focus:ring-4 focus:ring-[#fff0f2]"
            />
            <p className="mt-1 text-right text-xs text-[#aaa0a2]">{body.length.toLocaleString()} / 5,000</p>
          </section>

          <section className="rounded-[26px] border border-[#eee0e3] bg-white p-5 sm:p-7">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-black">식당 태그 <span className="font-medium text-[#a89da0]">(선택)</span></h2>
                <p className="mt-1 text-xs leading-5 text-[#8d8284]">맛픽 식당과 회원 추천 식당을 최대 3곳까지 연결할 수 있어요.</p>
              </div>
              <span className="text-xs font-bold text-[#ff7483]">{placeTags.length}/3</span>
            </div>

            {placeTags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {placeTags.map((tag) => (
                  <span key={`${tag.kind}-${tag.id}`} className="inline-flex max-w-full items-center rounded-full bg-[#fff0f2] py-1.5 pl-3 pr-2 text-xs font-bold text-[#ff6575]">
                    <MapPin className="mr-1 h-3.5 w-3.5 flex-shrink-0" />
                    <span className="truncate">{tag.name}</span>
                    <button type="button" onClick={() => setPlaceTags((current) => current.filter((item) => !(item.kind === tag.kind && item.id === tag.id)))} className="ml-1 flex h-5 w-5 items-center justify-center rounded-full hover:bg-white" aria-label={`${tag.name} 태그 삭제`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="relative mt-4">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-[#aa9fa1]" />
              <input
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.target.value)}
                disabled={placeTags.length >= 3}
                placeholder="식당명이나 주소로 검색"
                className="h-11 w-full rounded-2xl border border-[#eadde0] pl-11 pr-4 text-sm outline-none focus:border-[#ff9daa] disabled:bg-[#f7f4f5]"
              />
              {searchResults.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-[#eadde0] bg-white p-2 shadow-[0_18px_50px_rgba(40,25,30,0.12)]">
                  {searchResults.map((tag) => (
                    <button key={`${tag.kind}-${tag.id}`} type="button" onClick={() => addTag(tag)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[#fff5f7]">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-[#ff7483]">
                        {tag.kind === "official" ? <Check className="h-4 w-4" /> : <Store className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold">{tag.name}</span>
                        <span className="block truncate text-xs text-[#978c8e]">{tag.address}</span>
                      </span>
                      <span className="flex-shrink-0 text-[10px] font-bold text-[#b0a5a7]">{tag.kind === "official" ? "맛픽" : "회원 제보"}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <button type="button" onClick={() => setShowNewPlace((current) => !current)} disabled={placeTags.length >= 3} className="mt-4 inline-flex items-center text-sm font-bold text-[#ff6575] disabled:opacity-40">
              <Plus className="mr-1.5 h-4 w-4" />
              검색에 없는 새 식당 등록하기
            </button>

            {showNewPlace ? (
              <div className="mt-4 grid gap-3 rounded-[20px] border border-dashed border-[#ffcbd2] bg-[#fff8f9] p-4 sm:grid-cols-2">
                <input value={newPlace.name} onChange={(event) => setNewPlace((current) => ({ ...current, name: event.target.value }))} placeholder="식당명 *" maxLength={100} className="h-11 rounded-xl border border-[#eadde0] bg-white px-3 text-sm outline-none focus:border-[#ff9daa]" />
                <input value={newPlace.address} onChange={(event) => setNewPlace((current) => ({ ...current, address: event.target.value }))} placeholder="주소 *" maxLength={240} className="h-11 rounded-xl border border-[#eadde0] bg-white px-3 text-sm outline-none focus:border-[#ff9daa]" />
                <input value={newPlace.region} onChange={(event) => setNewPlace((current) => ({ ...current, region: event.target.value }))} placeholder="지역 (예: 서울 성수동)" maxLength={80} className="h-11 rounded-xl border border-[#eadde0] bg-white px-3 text-sm outline-none focus:border-[#ff9daa]" />
                <input value={newPlace.category} onChange={(event) => setNewPlace((current) => ({ ...current, category: event.target.value }))} placeholder="음식 종류" maxLength={80} className="h-11 rounded-xl border border-[#eadde0] bg-white px-3 text-sm outline-none focus:border-[#ff9daa]" />
                <input value={newPlace.mapUrl} onChange={(event) => setNewPlace((current) => ({ ...current, mapUrl: event.target.value }))} placeholder="네이버·카카오 지도 링크 (선택)" maxLength={600} className="h-11 rounded-xl border border-[#eadde0] bg-white px-3 text-sm outline-none focus:border-[#ff9daa] sm:col-span-2" />
                <p className="text-xs leading-5 text-[#8d8284] sm:col-span-2">글 등록과 함께 회원 추천 식당으로 제보되며, 운영자 확인 전까지 ‘검토 중’으로 표시됩니다.</p>
              </div>
            ) : null}
          </section>

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate("/community")} className="h-12 rounded-full border border-[#e7dadd] bg-white px-6 text-sm font-bold text-[#756a6c]">취소</button>
            <button type="submit" disabled={isSubmitting || !title.trim() || !body.trim()} className="h-12 rounded-full bg-[#ff7483] px-7 text-sm font-black text-white shadow-[0_12px_28px_rgba(255,116,131,0.24)] disabled:cursor-not-allowed disabled:opacity-45">
              {isSubmitting ? "등록 중..." : "라운지에 등록"}
            </button>
          </div>
        </form>
      </main>
    </CommunityShell>
  );
}
