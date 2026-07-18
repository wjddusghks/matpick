import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  ArrowRight,
  Clock3,
  MapPin,
  MessageCircle,
  PenLine,
  Search,
  Sparkles,
  Store,
} from "lucide-react";
import CommunityShell from "@/components/community/CommunityShell";
import {
  communityCategories,
  fetchCommunityPosts,
  fetchRestaurantSuggestions,
  formatCommunityDate,
  getCategoryLabel,
  type CommunityPost,
  type RestaurantSuggestion,
} from "@/lib/community";
import { useSeo } from "@/lib/seo";

export default function Community() {
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [suggestions, setSuggestions] = useState<RestaurantSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useSeo({
    title: "맛픽 라운지 | 맛집 추천·질문·토론",
    description: "맛집을 태그하고 추천, 질문, 방문 후기를 나누는 맛픽 커뮤니티입니다.",
    path: "/community",
    type: "website",
  });

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    setError("");
    void fetchCommunityPosts(category, submittedQuery)
      .then((items) => {
        if (!ignore) setPosts(items);
      })
      .catch((cause) => {
        if (!ignore) setError(cause instanceof Error ? cause.message : "게시글을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [category, submittedQuery]);

  useEffect(() => {
    void fetchRestaurantSuggestions(5)
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, []);

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    setSubmittedQuery(query.trim());
  };

  return (
    <CommunityShell>
      <main>
        <section className="border-b border-[#f3dfe3] bg-[radial-gradient(circle_at_20%_0%,#ffe9ed_0%,#fff8f9_40%,#ffffff_100%)]">
          <div className="mx-auto grid max-w-[1180px] gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1fr_380px] lg:items-end">
            <div>
              <span className="inline-flex items-center rounded-full border border-[#ffcdd4] bg-white px-3 py-1 text-xs font-bold text-[#ff6777]">
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                맛있는 이야기가 모이는 곳
              </span>
              <h1 className="mt-4 break-keep text-[34px] font-black leading-tight tracking-[-0.04em] text-[#191516] sm:text-[48px]">
                식당을 콕 집어 태그하고
                <br />맛집 이야기를 나눠보세요.
              </h1>
              <p className="mt-4 max-w-2xl break-keep text-sm leading-7 text-[#756a6c] sm:text-base">
                맛픽에 있는 식당, 회원이 제보한 식당, 아직 등록되지 않은 새로운 식당까지 자유롭게 연결할 수 있어요.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/community/new"
                className="flex min-h-28 flex-col justify-between rounded-[24px] bg-[#ff7483] p-5 text-white no-underline shadow-[0_18px_40px_rgba(255,116,131,0.24)]"
              >
                <PenLine className="h-6 w-6" />
                <span className="flex items-center justify-between text-sm font-black">
                  이야기 쓰기 <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
              <Link
                href="/suggest"
                className="flex min-h-28 flex-col justify-between rounded-[24px] border border-[#f1dfe2] bg-white p-5 text-[#332d2e] no-underline shadow-[0_18px_40px_rgba(50,30,35,0.06)]"
              >
                <Store className="h-6 w-6 text-[#ff7483]" />
                <span className="flex items-center justify-between text-sm font-black">
                  맛집 제보 <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1180px] gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            <form onSubmit={handleSearch} className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#aa9fa1]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="제목, 내용, 식당 이름 검색"
                className="h-13 w-full rounded-2xl border border-[#eadde0] bg-white pl-12 pr-24 text-sm outline-none transition focus:border-[#ff9daa] focus:ring-4 focus:ring-[#fff0f2]"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 h-9 -translate-y-1/2 rounded-xl bg-[#292425] px-4 text-xs font-bold text-white"
              >
                검색
              </button>
            </form>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
              {communityCategories.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setCategory(item.key)}
                  className={`flex-shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                    category === item.key
                      ? "bg-[#ff7483] text-white"
                      : "border border-[#eadde0] bg-white text-[#6e6365] hover:border-[#ffbac3]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            <section className="mt-3 space-y-3">
              {isLoading ? (
                <div className="rounded-[24px] border border-dashed border-[#eadde0] bg-white px-6 py-16 text-center text-sm text-[#9b9092]">
                  라운지 이야기를 불러오는 중이에요.
                </div>
              ) : null}
              {error ? (
                <div className="rounded-[24px] border border-[#ffd9df] bg-[#fff5f7] px-6 py-8 text-center text-sm text-[#b24c5a]">
                  {error}
                </div>
              ) : null}
              {!isLoading && !error && posts.length === 0 ? (
                <div className="rounded-[24px] border border-dashed border-[#eadde0] bg-white px-6 py-16 text-center">
                  <MessageCircle className="mx-auto h-8 w-8 text-[#ff9baa]" />
                  <p className="mt-3 text-base font-black">아직 등록된 이야기가 없어요.</p>
                  <p className="mt-2 text-sm text-[#8b8082]">첫 번째 맛집 이야기를 시작해 보세요.</p>
                  <Link href="/community/new" className="mt-5 inline-flex rounded-full bg-[#ff7483] px-5 py-2.5 text-sm font-bold text-white no-underline">
                    첫 글 작성하기
                  </Link>
                </div>
              ) : null}
              {posts.map((post) => (
                <Link
                  key={post.id}
                  href={`/community/post/${post.id}`}
                  className="block rounded-[24px] border border-[#eee2e4] bg-white p-5 no-underline shadow-[0_10px_32px_rgba(45,28,32,0.04)] transition hover:-translate-y-0.5 hover:border-[#ffc5cd] hover:shadow-[0_16px_38px_rgba(45,28,32,0.08)] sm:p-6"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-[#fff0f2] px-2.5 py-1 font-bold text-[#ff6575]">
                      {getCategoryLabel(post.category)}
                    </span>
                    <span className="font-semibold text-[#746a6c]">{post.authorName}</span>
                    <span className="text-[#c0b7b9]">·</span>
                    <span className="inline-flex items-center text-[#9b9193]">
                      <Clock3 className="mr-1 h-3.5 w-3.5" />
                      {formatCommunityDate(post.createdAt)}
                    </span>
                  </div>
                  <h2 className="mt-3 break-keep text-lg font-black tracking-[-0.02em] text-[#211c1d] sm:text-xl">
                    {post.title}
                  </h2>
                  <p className="mt-2 line-clamp-2 whitespace-pre-line break-words text-sm leading-6 text-[#786e70]">
                    {post.body}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {post.placeTags.map((tag) => (
                      <span key={`${tag.kind}-${tag.id}`} className="inline-flex max-w-full items-center rounded-full border border-[#f0dfe2] bg-[#fffafa] px-3 py-1.5 text-xs font-bold text-[#665c5e]">
                        <MapPin className="mr-1 h-3.5 w-3.5 flex-shrink-0 text-[#ff7483]" />
                        <span className="truncate">{tag.name}</span>
                      </span>
                    ))}
                    <span className="ml-auto inline-flex items-center text-xs font-semibold text-[#9a8f91]">
                      <MessageCircle className="mr-1 h-4 w-4" />
                      {post.commentCount}
                    </span>
                  </div>
                </Link>
              ))}
            </section>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
            <section className="rounded-[24px] border border-[#eee1e4] bg-white p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-black">최근 회원 추천 식당</h2>
                <Store className="h-4 w-4 text-[#ff7483]" />
              </div>
              <div className="mt-4 space-y-3">
                {suggestions.length > 0 ? suggestions.map((item) => (
                  <div key={item.id} className="border-b border-[#f3e9eb] pb-3 last:border-0 last:pb-0">
                    <p className="text-sm font-bold text-[#2d2728]">{item.name}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-[#8e8385]">{item.address}</p>
                    <p className="mt-1 text-[11px] text-[#b0a5a7]">{item.authorName}님의 제보</p>
                  </div>
                )) : (
                  <p className="text-xs leading-5 text-[#998e90]">아직 제보된 식당이 없어요.</p>
                )}
              </div>
              <Link href="/suggest" className="mt-5 flex h-10 items-center justify-center rounded-full bg-[#fff0f2] text-xs font-black text-[#ff6575] no-underline">
                내가 아는 맛집 제보하기
              </Link>
            </section>
            <section className="rounded-[24px] bg-[#282324] p-5 text-white">
              <p className="text-sm font-black">라운지 이용 안내</p>
              <p className="mt-2 text-xs leading-5 text-white/65">
                글과 댓글 작성은 로그인 회원만 가능해요. 서로 다른 입맛을 존중하고 확인되지 않은 정보는 단정하지 말아 주세요.
              </p>
            </section>
          </aside>
        </div>
      </main>
    </CommunityShell>
  );
}
