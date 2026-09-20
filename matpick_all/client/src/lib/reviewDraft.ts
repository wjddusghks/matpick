export type ReviewDraft = {
  text: string;
  stars: number;
  visited: boolean;
  updatedAt: number;
};
const maxAge = 24 * 60 * 60 * 1000;
const key = (id: string) => `matpick_review_draft_${id}`;
export function readReviewDraft(id: string): ReviewDraft {
  const empty = { text: "", stars: 0, visited: false, updatedAt: Date.now() };
  try {
    const value = JSON.parse(sessionStorage.getItem(key(id)) || "null");
    if (
      !value ||
      !Number.isFinite(value.updatedAt) ||
      Date.now() - value.updatedAt > maxAge
    )
      return empty;
    return {
      text: typeof value.text === "string" ? value.text.slice(0, 2000) : "",
      stars:
        Number.isInteger(value.stars) && value.stars >= 1 && value.stars <= 5
          ? value.stars
          : 0,
      visited: value.visited === true,
      updatedAt: value.updatedAt,
    };
  } catch {
    return empty;
  }
}
export function saveReviewDraft(id: string, draft: ReviewDraft) {
  try {
    sessionStorage.setItem(key(id), JSON.stringify(draft));
  } catch {
    /* Writing remains available without storage. */
  }
}
export function clearReviewDraft(id: string) {
  try {
    sessionStorage.removeItem(key(id));
  } catch {
    /* Storage may be disabled. */
  }
}
export const reviewReturnPath = (id: string) =>
  `/restaurant/${encodeURIComponent(id)}?writeReview=1#detail-reviews-title`;
