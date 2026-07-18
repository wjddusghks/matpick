import type { User } from "@/contexts/AuthContext";

export type CommunityCategory =
  | "recommendation"
  | "question"
  | "discussion"
  | "review"
  | "information";

export type PlaceTag = {
  kind: "official" | "suggestion";
  id: string;
  name: string;
  address: string;
  category: string;
  region: string;
};

export type CommunityPost = {
  id: string;
  authorName: string;
  title: string;
  body: string;
  category: CommunityCategory;
  placeTags: PlaceTag[];
  commentCount: number;
  createdAt: number;
  updatedAt: number;
};

export type CommunityComment = {
  id: string;
  postId: string;
  authorName: string;
  body: string;
  createdAt: number;
};

export type RestaurantSuggestion = {
  id: string;
  authorName: string;
  name: string;
  address: string;
  region: string;
  category: string;
  mapUrl: string;
  reason: string;
  status: "pending" | "published" | "merged" | "rejected";
  mergedRestaurantId?: string;
  createdAt: number;
  updatedAt: number;
  isOwner?: boolean;
};

export const communityCategories: Array<{
  key: "all" | CommunityCategory;
  label: string;
}> = [
  { key: "all", label: "전체" },
  { key: "recommendation", label: "맛집 추천" },
  { key: "question", label: "질문" },
  { key: "discussion", label: "토론" },
  { key: "review", label: "방문 후기" },
  { key: "information", label: "정보 공유" },
];

export function getCategoryLabel(category: CommunityCategory) {
  return communityCategories.find((item) => item.key === category)?.label ?? "자유 토론";
}

export function formatCommunityDate(timestamp: number) {
  const date = new Date(timestamp);
  const now = Date.now();
  const minutes = Math.floor((now - date.getTime()) / 60000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 전`;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(date);
}

async function readError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    return payload.error || "요청을 처리하지 못했습니다.";
  } catch {
    return "요청을 처리하지 못했습니다.";
  }
}

function requireUser(user: User | null) {
  if (!user?.id || !user.syncToken) {
    throw new Error("로그인이 필요합니다.");
  }
  return user;
}

function getMemberPayload(user: User) {
  return {
    userId: user.id,
    syncToken: user.syncToken,
    authorName: user.nickname || user.name,
  };
}

export async function fetchCommunityPosts(category = "all", query = "") {
  const params = new URLSearchParams({ limit: "80" });
  if (category !== "all") params.set("category", category);
  if (query.trim()) params.set("query", query.trim());
  const response = await fetch(`/api/community/posts?${params.toString()}`);
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { posts?: CommunityPost[] };
  return Array.isArray(payload.posts) ? payload.posts : [];
}

export async function fetchCommunityPost(id: string) {
  const response = await fetch(`/api/community/posts?id=${encodeURIComponent(id)}`);
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { post?: CommunityPost };
  if (!payload.post) throw new Error("게시글을 찾을 수 없습니다.");
  return payload.post;
}

export async function createCommunityPost(
  user: User | null,
  input: Pick<CommunityPost, "title" | "body" | "category" | "placeTags">
) {
  const member = requireUser(user);
  const response = await fetch("/api/community/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getMemberPayload(member), ...input }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { post?: CommunityPost };
  if (!payload.post) throw new Error("게시글을 저장하지 못했습니다.");
  return payload.post;
}

export async function fetchCommunityComments(postId: string) {
  const response = await fetch(
    `/api/community/comments?postId=${encodeURIComponent(postId)}`
  );
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { comments?: CommunityComment[] };
  return Array.isArray(payload.comments) ? payload.comments : [];
}

export async function createCommunityComment(
  user: User | null,
  postId: string,
  body: string
) {
  const member = requireUser(user);
  const response = await fetch("/api/community/comments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getMemberPayload(member), postId, body }),
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { comment?: CommunityComment };
  if (!payload.comment) throw new Error("댓글을 저장하지 못했습니다.");
  return payload.comment;
}

export async function fetchRestaurantSuggestions(limit = 40) {
  const response = await fetch(`/api/community/suggestions?limit=${limit}`);
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { suggestions?: RestaurantSuggestion[] };
  return Array.isArray(payload.suggestions) ? payload.suggestions : [];
}

export async function fetchMyRestaurantSuggestions(user: User | null) {
  const member = requireUser(user);
  const response = await fetch("/api/community/suggestions?mine=1&limit=100", {
    headers: {
      "X-Matpick-User-Id": member.id,
      "X-Matpick-Sync-Token": member.syncToken || "",
    },
  });
  if (!response.ok) throw new Error(await readError(response));
  const payload = (await response.json()) as { suggestions?: RestaurantSuggestion[] };
  return Array.isArray(payload.suggestions) ? payload.suggestions : [];
}

export async function createRestaurantSuggestion(
  user: User | null,
  input: Pick<
    RestaurantSuggestion,
    "name" | "address" | "region" | "category" | "mapUrl" | "reason"
  >
) {
  const member = requireUser(user);
  const response = await fetch("/api/community/suggestions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...getMemberPayload(member), ...input }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    suggestion?: RestaurantSuggestion;
  };
  if (!response.ok) {
    const error = new Error(payload.error || "추천 식당을 저장하지 못했습니다.");
    Object.assign(error, { suggestion: payload.suggestion });
    throw error;
  }
  if (!payload.suggestion) throw new Error("추천 식당을 저장하지 못했습니다.");
  return payload.suggestion;
}
