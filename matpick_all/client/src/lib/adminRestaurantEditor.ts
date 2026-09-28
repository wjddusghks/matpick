import type { MenuItem, Restaurant, SourceLink } from "@/data/types";

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
  sourceLinks: SourceLink[];
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
  if ("sourceLinks" in changes)
    changes.sourceLinks = draft.sourceLinks.map((link, index) => {
      const label = link.label?.trim();
      const note = link.note?.trim();
      const sourceUrl = link.sourceUrl?.trim();
      const broadcastDate = link.broadcastDate?.trim();
      return {
        id: link.id || `admin:${index + 1}`,
        restaurantId: link.restaurantId,
        sourceId: link.sourceId,
        ...(Number.isFinite(link.ordinal) ? { ordinal: link.ordinal } : {}),
        ...(label ? { label } : {}),
        ...(note ? { note } : {}),
        ...(sourceUrl ? { sourceUrl } : {}),
        ...(broadcastDate ? { broadcastDate } : {}),
        ...(link.episodeSeries ? { episodeSeries: link.episodeSeries } : {}),
        ...(Number.isFinite(link.episodeNumber)
          ? { episodeNumber: link.episodeNumber }
          : {}),
        ...(link.episodePart ? { episodePart: link.episodePart } : {}),
        ...(Number.isFinite(link.season) ? { season: link.season } : {}),
      };
    });
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
  if ("sourceLinks" in changes) {
    if (draft.sourceLinks.length > 20)
      return {
        message: "방송·가이드 출처는 최대 20개까지 등록할 수 있어요.",
        tab: "sources",
        field: "sourceLinks",
      };
    for (const [index, link] of Array.from(draft.sourceLinks.entries())) {
      if (!link.sourceId.trim())
        return {
          message: "방송·채널·가이드를 선택해 주세요.",
          tab: "sources",
          field: `broadcast-source-${index}`,
        };
      if (link.sourceUrl) {
        try {
          const parsed = new URL(link.sourceUrl);
          if (!["https:", "http:"].includes(parsed.protocol)) throw new Error();
        } catch {
          return {
            message: "방송 출처 링크를 http 또는 https 주소로 입력해 주세요.",
            tab: "sources",
            field: `broadcast-url-${index}`,
          };
        }
      }
      if (
        link.broadcastDate &&
        (!/^\d{4}-\d{2}-\d{2}$/.test(link.broadcastDate) ||
          !Number.isFinite(Date.parse(link.broadcastDate)) ||
          new Date(link.broadcastDate).toISOString().slice(0, 10) !==
            link.broadcastDate)
      )
        return {
          message: "방송일을 확인해 주세요.",
          tab: "sources",
          field: `broadcast-date-${index}`,
        };
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
  let duplicates = 0;
  const pending: Array<{ text: string; line: number }> = [];
  const seen = new Set<string>();
  const amount = "(?:\\d{1,3}(?:,\\d{3})+|\\d+)";
  const pricePattern = `(?:${amount}\\s*원(?:\\s*[~～–-]\\s*${amount}\\s*원)?|${amount}\\s*[~～–-]\\s*${amount}\\s*원|시가|싯가|변동(?:가격)?(?:\\s*\\(.*\\))?|가격\\s*문의|무료)`;
  const priceOnly = new RegExp(
    `^(?:${pricePattern}|\\d{1,3}(?:,\\d{3})+|\\d{4,})$`
  );
  const inline = new RegExp(`^(.+?)\\s+(?:[:：]\\s*)?(${pricePattern})$`);
  function add(name: string, rawPrice: string, line: number) {
    const price = formatMenuPrice(rawPrice);
    if (
      !name ||
      name.length > 200 ||
      price.length > 120 ||
      /^[-−]\s*\d/.test(price)
    ) {
      errors.push(`${line}행: 메뉴명과 가격을 확인해 주세요.`);
      return;
    }
    const key = `${name.replace(/\s+/g, " ")}\t${price}`;
    if (seen.has(key)) {
      duplicates++;
      return;
    }
    seen.add(key);
    rows.push({ name, price });
  }
  function flushNames() {
    pending.splice(0).forEach(item => add(item.text, "", item.line));
  }
  value.split(/\r?\n/).forEach((raw, index) => {
    const line = raw
      .replace(/\[([^\]]+)\]\(https?:\/\/[^\s]+\)/g, "$1")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\u00a0/g, " ")
      .replace(/^[ \t]*[-•·]\s+(?=\D)/, "")
      .replace(/\*\*/g, "")
      .replace(/\*/g, "")
      .trim();
    if (
      !line ||
      /^(?:대표|인기|추천|메뉴|메뉴판|메뉴판 이미지|메뉴 이미지|사진|더보기|접기|펼쳐보기|주문|주문하기|네이버페이|이미지 준비중|메뉴 더보기|홈|리뷰|정보)$/.test(
        line
      )
    )
      return;
    if (/^https?:\/\//.test(line)) return;
    const cleaned = line.replace(/^(?:대표|인기)\s+/, "");
    if (raw.includes("\t")) {
      flushNames();
      const columns = cleaned.split("\t");
      if (columns.length > 2)
        errors.push(`${index + 1}행: 메뉴명과 가격 두 열을 확인해 주세요.`);
      else add(columns[0].trim(), columns[1]?.trim() || "", index + 1);
      return;
    }
    if (/(?:^|\s)[-−]\s*\d/.test(cleaned)) {
      errors.push(`${index + 1}행: 음수 가격은 입력할 수 없어요.`);
      pending.length = 0;
      return;
    }
    if (priceOnly.test(cleaned)) {
      if (pending.length === 1) add(pending[0].text, cleaned, pending[0].line);
      else
        errors.push(
          `${index + 1}행: ‘${cleaned}’ 바로 위에 메뉴명 하나만 남겨 주세요. 설명·수량·안내 문구는 지워 주세요.`
        );
      pending.length = 0;
      return;
    }
    const match = cleaned.match(inline);
    if (match) {
      flushNames();
      add(match[1].trim(), match[2], index + 1);
    } else pending.push({ text: cleaned, line: index + 1 });
  });
  flushNames();
  return { rows, errors, duplicates };
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
