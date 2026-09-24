export const suggestionTags = [
  "데이트",
  "혼밥",
  "가족 식사",
  "친구 모임",
  "여행",
  "가성비",
];
export type SuggestedMenu = { name: string; price: string; unit: string };
export type SuggestionDraft = {
  requestId: string;
  name: string;
  location: string;
  mapUrl: string;
  menus: SuggestedMenu[];
  checkedAt: string;
  sourceNote: string;
  relationship: "visitor" | "owner" | "discovered";
  tags: string[];
  reason: string;
};
export type SuggestionReceipt = {
  id: string;
  createdAt: number;
  status: string;
};
export type SuggestionItem = Omit<SuggestionDraft, "menus"> & {
  menus: { name: string; price: number | null; unit: string }[];
  id: string;
  createdAt: number;
  status: "pending" | "reviewed" | "archived";
};
export const SUGGESTIONS_API = "/api/restaurants?scope=suggestions";
export const SUGGESTION_DRAFT_KEY = "matpick:suggestion-draft:v1";
export const emptyMenu = (): SuggestedMenu => ({
  name: "",
  price: "",
  unit: "",
});

export function newSuggestion(): SuggestionDraft {
  return {
    requestId: crypto.randomUUID(),
    name: "",
    location: "",
    mapUrl: "",
    menus: [emptyMenu()],
    checkedAt: "",
    sourceNote: "",
    relationship: "discovered",
    tags: [],
    reason: "",
  };
}

export function readSuggestionDraft(): {
  draft: SuggestionDraft;
  step: number;
  restored: boolean;
} {
  const fallback = { draft: newSuggestion(), step: 0, restored: false };
  try {
    const stored = JSON.parse(
      sessionStorage.getItem(SUGGESTION_DRAFT_KEY) || "null"
    );
    if (!stored || Date.now() - stored.savedAt > 7 * 86400000) return fallback;
    const draft = stored.draft;
    if (!draft || !/^[a-f0-9-]{36}$/i.test(draft.requestId)) return fallback;
    for (const field of [
      "name",
      "location",
      "mapUrl",
      "checkedAt",
      "sourceNote",
      "reason",
    ])
      if (typeof draft[field] !== "string") return fallback;
    if (!["visitor", "owner", "discovered"].includes(draft.relationship))
      return fallback;
    if (
      !Array.isArray(draft.tags) ||
      draft.tags.some((tag: string) => !suggestionTags.includes(tag))
    )
      return fallback;
    if (
      !Array.isArray(draft.menus) ||
      !draft.menus.length ||
      draft.menus.length > 8 ||
      draft.menus.some(
        (menu: SuggestedMenu) =>
          !menu ||
          [menu.name, menu.price, menu.unit].some(
            value => typeof value !== "string"
          )
      )
    )
      return fallback;
    return {
      draft,
      step: Number.isInteger(stored.step)
        ? Math.min(2, Math.max(0, stored.step))
        : 0,
      restored: Boolean(draft.name || draft.location),
    };
  } catch {
    return fallback;
  }
}

export function validateSuggestionStep(
  draft: SuggestionDraft,
  step: number,
  consent: boolean
) {
  const errors: Record<string, string> = {};
  if (step === 0) {
    if (!draft.name.trim()) errors.name = "식당 이름을 알려주세요.";
    if (!draft.location.trim())
      errors.location = "지역이나 주소를 알려주세요. 예: 부산 해운대구 중동";
    if (draft.mapUrl.trim()) {
      try {
        const url = new URL(draft.mapUrl.trim());
        if (
          !["http:", "https:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error();
      } catch {
        errors.mapUrl =
          "https:// 또는 http://로 시작하는 링크를 붙여 넣어 주세요.";
      }
    }
  }
  if (step === 1) {
    draft.menus.forEach((menu, i) => {
      if (!menu.name.trim() && (menu.price.trim() || menu.unit.trim()))
        errors[`menu-${i}-name`] = "이 메뉴의 이름도 알려주세요.";
      if (
        menu.price &&
        (!/^[\d,]+$/.test(menu.price) ||
          Number(menu.price.replace(/,/g, "")) > 10000000)
      )
        errors[`menu-${i}-price`] =
          "가격은 0~10,000,000원 사이로 입력해 주세요.";
    });
    const date = draft.checkedAt;
    if (
      date &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        Number.isNaN(Date.parse(date)) ||
        new Date(date).toISOString().slice(0, 10) !== date ||
        date >
          new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }))
    )
      errors.checkedAt = "오늘 또는 이전 날짜를 선택해 주세요.";
  }
  if (step === 2 && !consent)
    errors.consent = "제보 정보 활용에 동의해 주세요.";
  return errors;
}
