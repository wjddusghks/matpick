import type { MenuItem, Restaurant } from "@/data/types";

export type EditorTab = "menus" | "info" | "sources";
export function hasKnownMenuPrice(price?: string) {
  const value = price?.trim() || "";
  return (
    (/\d/.test(value) && !/미공개|미확인|문의/.test(value)) || value === "무료"
  );
}
export type RestaurantDraft = {
  name: string;
  address: string;
  region: string;
  category: string;
  phone: string;
  lat: string;
  lng: string;
  operationState: NonNullable<Restaurant["operationState"]>;
  menus: MenuItem[];
  menuPriceVerifiedAt: string;
  menuPriceNote: string;
  menuPriceSources: Array<{ url: string; label: string }>;
};

export function formatMenuPrice(value: string) {
  const trimmed = value.trim();
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)\s*원?$/.test(trimmed)) return trimmed;
  const amount = Number(trimmed.replace(/[,\s원]/g, ""));
  return Number.isSafeInteger(amount)
    ? `${amount.toLocaleString("ko-KR")}원`
    : trimmed;
}

export function buildRestaurantChanges(
  draft: RestaurantDraft,
  initial: RestaurantDraft
) {
  const changes: Record<string, unknown> = Object.fromEntries(
    Object.entries(draft).filter(
      ([key, value]) =>
        JSON.stringify(value) !==
        JSON.stringify(initial[key as keyof RestaurantDraft])
    )
  );
  for (const key of ["lat", "lng"] as const)
    if (key in changes) changes[key] = Number(draft[key]);
  if ("menus" in changes) {
    changes.menus = draft.menus.map(menu => ({
      ...menu,
      price: formatMenuPrice(menu.price || ""),
    }));
    changes.menuPriceVerifiedAt = draft.menuPriceVerifiedAt;
    changes.menuPriceSources = draft.menuPriceSources;
    changes.menuPriceNote = draft.menuPriceNote;
  }
  if ("menuPriceSources" in changes)
    changes.menuPriceSources = draft.menuPriceSources.filter(source =>
      source.url.trim()
    );
  return changes;
}

export type DraftIssue = { message: string; tab: EditorTab; field: string };
export function validateRestaurantDraft(
  draft: RestaurantDraft,
  initial: RestaurantDraft
): DraftIssue | null {
  const changes = buildRestaurantChanges(draft, initial);
  for (const [key, label] of [
    ["name", "식당명"],
    ["address", "주소"],
    ["region", "지역"],
    ["category", "음식 종류"],
  ] as const) {
    if (key in changes && !draft[key].trim())
      return { message: `${label}을 입력해 주세요.`, tab: "info", field: key };
  }
  for (const [key, max] of [
    ["lat", 90],
    ["lng", 180],
  ] as const) {
    const n = Number(draft[key]);
    if (key in changes && (!Number.isFinite(n) || !n || Math.abs(n) > max))
      return {
        message: "위도와 경도를 확인해 주세요.",
        tab: "info",
        field: key,
      };
  }
  if ("menus" in changes) {
    if (draft.menus.length > 100)
      return {
        message: "메뉴는 최대 100개까지 추가할 수 있어요.",
        tab: "menus",
        field: "menus",
      };
    for (const menu of draft.menus) {
      if (!menu.name.trim())
        return {
          message: "이름이 없는 메뉴가 있어요. 메뉴명을 입력해 주세요.",
          tab: "menus",
          field: `name-${menu.id}`,
        };
      if (/^[-−]\s*\d/.test(menu.price?.trim() || ""))
        return {
          message: "메뉴 가격은 음수로 입력할 수 없어요.",
          tab: "menus",
          field: `price-${menu.id}`,
        };
    }
  }
  if ("menuPriceVerifiedAt" in changes && draft.menuPriceVerifiedAt) {
    const date = draft.menuPriceVerifiedAt;
    const time = Date.parse(date);
    const today = new Date().toLocaleDateString("en-CA", {
      timeZone: "Asia/Seoul",
    });
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(time) ||
      new Date(time).toISOString().slice(0, 10) !== date ||
      date > today
    )
      return {
        message: "확인일은 오늘 또는 이전 날짜를 선택해 주세요.",
        tab: "sources",
        field: "menuPriceVerifiedAt",
      };
  }
  if ("menuPriceSources" in changes) {
    for (const [index, source] of Array.from(
      draft.menuPriceSources.entries()
    )) {
      if (!source.url.trim()) continue;
      try {
        const url = new URL(source.url.trim());
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.username ||
          url.password
        )
          throw new Error();
      } catch {
        return {
          message: "출처 링크를 http 또는 https 주소로 입력해 주세요.",
          tab: "sources",
          field: `source-${index}`,
        };
      }
    }
  }
  return null;
}

export type RemovedMenu = { index: number; menu: MenuItem };
export function restoreRemovedMenus(
  current: MenuItem[],
  removed: RemovedMenu[]
) {
  const restored = [...current];
  for (const { index, menu } of removed) {
    if (!restored.some(item => item.id === menu.id))
      restored.splice(Math.min(index, restored.length), 0, menu);
  }
  return restored;
}

export function parseMenuPaste(value: string) {
  const rows: Array<{ name: string; price: string }> = [];
  const errors: string[] = [];
  value.split(/\r?\n/).forEach((line, index) => {
    if (!line.trim()) return;
    const columns = line.split("\t");
    const name = columns[0].trim();
    const price = formatMenuPrice(columns[1] || "");
    if (
      columns.length > 2 ||
      !name ||
      name.length > 200 ||
      price.length > 120 ||
      /^[-−]\s*\d/.test(price)
    )
      errors.push(`${index + 1}행: 메뉴명과 가격 두 열을 확인해 주세요.`);
    else rows.push({ name, price });
  });
  return { rows, errors };
}

export function menuChangeSummary(initial: MenuItem[], current: MenuItem[]) {
  const old = new Map(initial.map(menu => [menu.id, menu]));
  const ids = new Set(current.map(menu => menu.id));
  return {
    added: current.filter(menu => !old.has(menu.id)).length,
    removed: initial.filter(menu => !ids.has(menu.id)).length,
    updated: current.filter(
      menu =>
        old.has(menu.id) &&
        JSON.stringify(old.get(menu.id)) !== JSON.stringify(menu)
    ).length,
  };
}
