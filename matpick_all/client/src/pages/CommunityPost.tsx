import { useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Clock3, MapPin, MessageCircle, Send, Store } from "lucide-react";
import { toast } from "sonner";
import CommunityShell from "@/components/community/CommunityShell";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCommunityComment,
  fetchCommunityComments,
  fetchCommunityPost,
  formatCommunityDate,
  getCategoryLabel,
  type CommunityComment,
  type CommunityPost as CommunityPostType,
  type PlaceTag,
} from "@/lib/community";
import { useSeo } from "@/lib/seo";

function getPlaceHref(tag: PlaceTag) {
  return tag.kind === "official" ? `/restaurant/${tag.id}` : "/suggest";
}

export default function CommunityPost({ postId }: { postId: string }) {
  const { user, isLoggedIn } = useAuth();
  const [post, setPost] = useState<CommunityPostType | null>(null);
  const [comments, setComments] = useState<CommunityComment[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useSeo({
    title: post ? `${post.title} | 맛픽 라운지` : "맛픽 라운지",
    description: post?.body.slice(0, 150) || "맛픽 회원들의 맛집 이야기",
    path: `/community/post/${postId}`,
  });

  useEffect(() => {
    let ignore = false;
    setIsLoading(true);
    Promise.all([fetchCommunityPost(postId), fetchCommunityComments(postId)])
      .then(([nextPost, nextComments]) => {
        if (!ignore) {
          setPost(nextPost);
          setComments(nextComments);
        }
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
  }, [postId]);

  const submitComment = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setIsSubmitting(true);
    try {
      const comment = await createCommunityComment(user, postId, draft.trim());
      setComments((current) => [comment, ...current]);
      setDraft("");
      setPost((current) => current ? { ...current, commentCount: current.commentCount + 1 } : current);
      toast.success("댓글을 등록했어요.");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "댓글을 등록하지 못했습니다.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <CommunityShell showBack>
      <main className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 sm:py-12">
        {isLoading ? (
          <div className="rounded-[28px] border border-dashed border-[#eadde0] bg-white px-6 py-20 text-center text-sm text-[#9b9092]">게시글을 불러오는 중이에요.</div>
        ) : null}
        {error ? (
          <div className="rounded-[28px] border border-[#ffd9df] bg-[#fff5f7] px-6 py-16 text-center">
            <p className="text-sm font-bold text-[#b24c5a]">{error}</p>
            <Link href="/community" className="mt-5 inline-flex rounded-full bg-[#ff7483] px-5 py-2.5 text-sm font-bold text-white no-underline">목록으로</Link>
          </div>
        ) : null}

        {post ? (
          <>
            <article className="rounded-[30px] border border-[#eee0e3] bg-white p-6 shadow-[0_16px_46px_rgba(45,28,32,0.05)] sm:p-9">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-[#fff0f2] px-3 py-1.5 font-bold text-[#ff6575]">{getCategoryLabel(post.category)}</span>
                <span className="font-bold text-[#665c5e]">{post.authorName}</span>
                <span className="text-[#c1b7b9]">·</span>
                <span className="inline-flex items-center text-[#998e90]"><Clock3 className="mr-1 h-3.5 w-3.5" />{formatCommunityDate(post.createdAt)}</span>
              </div>
              <h1 className="mt-5 break-keep text-[28px] font-black leading-tight tracking-[-0.04em] text-[#201a1b] sm:text-[38px]">{post.title}</h1>
              <div className="mt-7 whitespace-pre-wrap break-words text-[15px] leading-8 text-[#50484a] sm:text-base">{post.body}</div>

              {post.placeTags.length > 0 ? (
                <section className="mt-8 border-t border-[#f1e5e7] pt-6">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#a09597]">이 글에 태그된 식당</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {post.placeTags.map((tag) => (
                      <Link key={`${tag.kind}-${tag.id}`} href={getPlaceHref(tag)} className="flex items-center gap-3 rounded-[18px] border border-[#eddee1] bg-[#fffafa] p-4 no-underline transition hover:border-[#ffb7c1]">
                        <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#fff0f2] text-[#ff7483]">
                          {tag.kind === "official" ? <MapPin className="h-5 w-5" /> : <Store className="h-5 w-5" />}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-[#2c2627]">{tag.name}</span>
                          <span className="mt-1 block truncate text-xs text-[#908587]">{tag.address}</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}
            </article>

            <section className="mt-6 rounded-[30px] border border-[#eee0e3] bg-white p-5 sm:p-7">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center text-base font-black"><MessageCircle className="mr-2 h-5 w-5 text-[#ff7483]" />댓글 {comments.length}</h2>
              </div>

              {isLoggedIn && user?.syncToken ? (
                <form onSubmit={submitComment} className="mt-5 flex items-end gap-2 rounded-[20px] border border-[#eadde0] bg-[#fffafa] p-3 focus-within:border-[#ffacb7]">
                  <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder="의견을 남겨보세요." className="min-h-12 flex-1 resize-none bg-transparent px-2 py-1 text-sm leading-6 outline-none" />
                  <button type="submit" disabled={isSubmitting || !draft.trim()} className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#ff7483] text-white disabled:opacity-40" aria-label="댓글 등록"><Send className="h-4 w-4" /></button>
                </form>
              ) : (
                <div className="mt-5 rounded-[20px] border border-[#f0dfe2] bg-[#fff8f9] p-4">
                  <p className="text-sm font-bold">로그인하고 토론에 참여해 보세요.</p>
                  <p className="mt-1 text-xs leading-5 text-[#8c8183]">댓글 작성은 맛픽 회원만 가능합니다.</p>
                  <SocialLoginButtons redirectTo={`/community/post/${postId}`} className="mt-4 max-w-sm" />
                </div>
              )}

              <div className="mt-5 space-y-3">
                {comments.map((comment) => (
                  <div key={comment.id} className="rounded-[20px] border border-[#f0e5e7] px-4 py-4">
                    <div className="flex items-center gap-2 text-xs"><span className="font-black text-[#4d4446]">{comment.authorName}</span><span className="text-[#c1b7b9]">·</span><span className="text-[#a09597]">{formatCommunityDate(comment.createdAt)}</span></div>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-[#61585a]">{comment.body}</p>
                  </div>
                ))}
                {comments.length === 0 ? <p className="py-8 text-center text-sm text-[#9b9092]">아직 댓글이 없어요. 첫 의견을 남겨보세요.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </main>
    </CommunityShell>
  );
}
