import { useEffect, useMemo, useState } from "react";
import { MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import AuthFeatureDialog from "@/components/AuthFeatureDialog";
import { useAuth } from "@/contexts/AuthContext";
import { useLocale } from "@/contexts/LocaleContext";
import { getDisplayName } from "@/lib/authProfile";
import { trackMarketingEvent } from "@/lib/marketing";
import {
  summarizeReviews,
  type ReviewSummary,
  type SharedReview,
} from "@/lib/reviews";
import {
  mergeRestaurantReviews,
  readRestaurantReviews,
  storeRestaurantReviews,
} from "@/lib/restaurantReviewData";

export default function RestaurantReviews({
  restaurantId,
  onSummary,
}: {
  restaurantId: string;
  onSummary: (summary: ReviewSummary) => void;
}) {
  const { isEnglish } = useLocale();
  const { isLoggedIn, user } = useAuth();
  const [reviews, setReviews] = useState(() =>
    readRestaurantReviews(restaurantId)
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading"
  );
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [composer, setComposer] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [stars, setStars] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const summary = useMemo(() => summarizeReviews(reviews), [reviews]);

  useEffect(() => onSummary(summary), [onSummary, summary]);
  useEffect(() => {
    const controller = new AbortController();
    setStatus("loading");
    void fetch(
      `/api/reviews?restaurantId=${encodeURIComponent(restaurantId)}`,
      { signal: controller.signal }
    )
      .then(async response => {
        if (!response.ok) throw new Error("Reviews unavailable");
        const payload = await response.json();
        if (!Array.isArray(payload.reviews))
          throw new Error("Invalid reviews response");
        if (controller.signal.aborted) return;
        setReviews(current => {
          const next = mergeRestaurantReviews(payload.reviews, current);
          storeRestaurantReviews(restaurantId, next);
          return next;
        });
        setStatus("ready");
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus("error");
      });
    return () => controller.abort();
  }, [restaurantId, attempt]);

  function openComposer() {
    if (!isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    setComposer(true);
    trackMarketingEvent("review_composer_open", {
      restaurant_id: restaurantId,
    });
  }

  async function submitReview() {
    if (!user || !isLoggedIn) {
      setAuthOpen(true);
      return;
    }
    if (!draft.trim() || submitting) return;
    setSubmitting(true);
    const review: SharedReview = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      user: getDisplayName(user),
      date: new Date()
        .toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
        .replace(/-/g, "."),
      stars,
      text: draft.trim(),
      photos: [],
      createdAt: Date.now(),
    };
    try {
      let savedReview = review;
      if (user.syncToken) {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            userId: user.id,
            syncToken: user.syncToken,
            review,
          }),
        });
        if (!response.ok) throw new Error("Could not save review");
        const payload = await response.json();
        savedReview =
          mergeRestaurantReviews([payload.review ?? review])[0] ?? review;
      }
      setReviews(current => {
        const next = mergeRestaurantReviews([savedReview], current);
        storeRestaurantReviews(restaurantId, next);
        return next;
      });
      setDraft("");
      setStars(5);
      setComposer(false);
      toast.success(
        user.syncToken
          ? isEnglish
            ? "Review posted."
            : "후기를 등록했어요."
          : isEnglish
            ? "Review saved on this device."
            : "후기를 이 기기에 저장했어요."
      );
      trackMarketingEvent("review_submit", {
        restaurant_id: restaurantId,
        stars,
        photo_count: 0,
      });
    } catch {
      toast.error(
        isEnglish
          ? "Could not post. Please try again."
          : "후기를 등록하지 못했어요. 다시 시도해 주세요."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="detail-section" aria-labelledby="detail-reviews-title">
      <AuthFeatureDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode="review"
        redirectTo={`/restaurant/${restaurantId}`}
      />
      <div className="detail-section-heading">
        <h2 id="detail-reviews-title">
          <MessageCircle aria-hidden="true" />
          {isEnglish ? "What visitors say" : "다녀온 사람들의 평"}
        </h2>
        <button
          className="detail-text-button"
          type="button"
          onClick={openComposer}
        >
          {isEnglish ? "Write a review" : "후기 남기기"}
        </button>
      </div>
      <div aria-live="polite">
        {summary.count > 0 && (
          <p className="detail-review-summary">
            <Star aria-hidden="true" />{" "}
            <strong>{summary.average.toFixed(1)}</strong>
            <span>
              {isEnglish
                ? `${summary.count} Matpick reviews`
                : `맛픽 방문자 후기 ${summary.count}개`}
            </span>
          </p>
        )}
        {status === "loading" && !reviews.length && (
          <p className="detail-muted">
            {isEnglish ? "Loading reviews…" : "후기를 불러오고 있어요."}
          </p>
        )}
        {status === "ready" && !reviews.length && (
          <p className="detail-muted">
            {isEnglish
              ? "No visitor reviews yet. Tell us how your meal was."
              : "아직 방문자 후기가 없어요. 다녀오셨다면 맛과 분위기를 알려주세요."}
          </p>
        )}
        {status === "error" && (
          <div className="detail-review-error">
            <p>
              {reviews.length
                ? isEnglish
                  ? "Latest reviews could not be loaded."
                  : "최신 후기를 불러오지 못했어요."
                : isEnglish
                  ? "Reviews could not be loaded."
                  : "후기를 불러오지 못했어요."}
            </p>
            <button
              type="button"
              className="detail-text-button"
              onClick={() => setAttempt(n => n + 1)}
            >
              {isEnglish ? "Retry" : "다시 보기"}
            </button>
          </div>
        )}
      </div>
      {composer && (
        <form
          className="detail-review-form"
          onSubmit={event => {
            event.preventDefault();
            void submitReview();
          }}
        >
          <fieldset disabled={submitting}>
            <legend>
              {isEnglish ? "Your rating" : "이번 식사는 어땠나요?"}
            </legend>
            <div className="detail-review-stars">
              {[1, 2, 3, 4, 5].map(value => (
                <button
                  key={value}
                  type="button"
                  aria-label={isEnglish ? `${value} stars` : `${value}점`}
                  aria-pressed={stars === value}
                  onClick={() => setStars(value)}
                >
                  <Star
                    fill={value <= stars ? "currentColor" : "none"}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="detail-review-text">
              {isEnglish ? "Review" : "후기 내용"}
            </label>
            <textarea
              id="detail-review-text"
              required
              maxLength={2000}
              value={draft}
              onChange={event => setDraft(event.target.value)}
              placeholder={
                isEnglish
                  ? "What did you eat? How was the food and atmosphere?"
                  : "먹은 메뉴와 맛, 대기나 분위기는 어땠나요?"
              }
            />
            <div className="detail-form-actions">
              <button
                className="detail-secondary-button"
                type="button"
                onClick={() => setComposer(false)}
              >
                {isEnglish ? "Cancel" : "취소"}
              </button>
              <button
                className="detail-primary-button"
                type="submit"
                disabled={!draft.trim() || submitting}
              >
                {submitting
                  ? isEnglish
                    ? "Posting…"
                    : "등록 중…"
                  : isEnglish
                    ? "Post review"
                    : "후기 등록"}
              </button>
            </div>
          </fieldset>
        </form>
      )}
      <div className="detail-review-list">
        {reviews.slice(0, expanded ? undefined : 3).map(review => (
          <article key={review.id} className="detail-review-item">
            <div className="detail-review-byline">
              <strong>{review.user}</strong>
              <span>{review.date}</span>
              <span
                className="detail-review-score"
                aria-label={`${review.stars} / 5`}
              >
                ★ {review.stars}
              </span>
            </div>
            {review.text && <p>{review.text}</p>}
            {!!review.photos.length && (
              <details className="detail-review-photos">
                <summary>
                  {isEnglish
                    ? `View ${review.photos.length} photos`
                    : `방문 사진 ${review.photos.length}장 보기`}
                </summary>
                <div>
                  {review.photos.map((photo, index) => (
                    <img
                      key={`${review.id}-${index}`}
                      src={photo}
                      alt={
                        isEnglish
                          ? `Visitor photo ${index + 1}`
                          : `방문 사진 ${index + 1}`
                      }
                      loading="lazy"
                    />
                  ))}
                </div>
              </details>
            )}
          </article>
        ))}
      </div>
      {reviews.length > 3 && (
        <button
          type="button"
          className="detail-expand-button"
          onClick={() => setExpanded(value => !value)}
        >
          {expanded
            ? isEnglish
              ? "Show less"
              : "후기 접기"
            : isEnglish
              ? `View all ${reviews.length} reviews`
              : `후기 ${reviews.length}개 모두 보기`}
        </button>
      )}
    </section>
  );
}
