export const FEEDBACK_API = "/api/restaurants?scope=feedback";
export type FeedbackCategory = "improvement" | "complaint" | "other";
export type FeedbackStatus = "new" | "reviewing" | "resolved";
export type FeedbackItem = {
  id: string;
  requestId: string;
  category: FeedbackCategory;
  message: string;
  language: "ko" | "en";
  pagePath: string;
  status: FeedbackStatus;
  createdAt: number;
  updatedAt: number;
};

export function currentFeedbackPath() {
  return typeof window === "undefined"
    ? "/"
    : window.location.pathname.slice(0, 300) || "/";
}

export async function submitFeedback(input: {
  requestId: string;
  category: FeedbackCategory;
  message: string;
  language: "ko" | "en";
  consent: boolean;
  website?: string;
}) {
  const response = await fetch(FEEDBACK_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...input, pagePath: currentFeedbackPath() }),
    signal: AbortSignal.timeout(15000),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok)
    throw new Error(body?.error || "Feedback could not be sent.");
  return body.receipt;
}
