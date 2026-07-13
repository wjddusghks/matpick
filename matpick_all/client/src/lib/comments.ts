export type RestaurantComment = {
  id: string;
  user: string;
  date: string;
  text: string;
  createdAt: number;
};

function normalizeComment(comment: RestaurantComment): RestaurantComment {
  return {
    id: String(comment.id || "").trim(),
    user: String(comment.user || "").trim(),
    date: String(comment.date || "").trim(),
    text: String(comment.text || "").trim().slice(0, 500),
    createdAt: Number.isFinite(comment.createdAt) ? comment.createdAt : Date.now(),
  };
}

export function mergeComments(...collections: RestaurantComment[][]) {
  const merged = new Map<string, RestaurantComment>();

  collections.flat().forEach((comment) => {
    const normalized = normalizeComment(comment);
    if (normalized.id && normalized.user && normalized.text) {
      merged.set(normalized.id, normalized);
    }
  });

  return Array.from(merged.values()).sort(
    (left, right) => right.createdAt - left.createdAt
  );
}

function getStorageKey(restaurantId: string) {
  return `matpick_comments_${restaurantId}`;
}

export function readStoredComments(restaurantId: string): RestaurantComment[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const value = window.localStorage.getItem(getStorageKey(restaurantId));
    return value ? mergeComments(JSON.parse(value) as RestaurantComment[]) : [];
  } catch {
    return [];
  }
}

export function saveStoredComments(
  restaurantId: string,
  comments: RestaurantComment[]
) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    getStorageKey(restaurantId),
    JSON.stringify(mergeComments(comments).slice(0, 200))
  );
}

export async function fetchRestaurantComments(restaurantId: string) {
  const response = await fetch(
    `/api/comments?restaurantId=${encodeURIComponent(restaurantId)}`
  );

  if (!response.ok) {
    throw new Error("Failed to load comments");
  }

  const payload = (await response.json()) as { comments?: RestaurantComment[] };
  return mergeComments(Array.isArray(payload.comments) ? payload.comments : []);
}

export async function postRestaurantComment({
  restaurantId,
  userId,
  syncToken,
  comment,
}: {
  restaurantId: string;
  userId: string;
  syncToken: string;
  comment: RestaurantComment;
}) {
  const response = await fetch("/api/comments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ restaurantId, userId, syncToken, comment }),
  });

  if (!response.ok) {
    throw new Error("Failed to save comment");
  }

  const payload = (await response.json()) as { comment?: RestaurantComment };
  return payload.comment ? normalizeComment(payload.comment) : comment;
}
