import type { Source, SourceLink } from "@/data/types";

export type RestaurantAppearance = {
  key: string;
  sourceId: string;
  sourceName: string;
  episode: string;
  episodeNumber: number;
  season: number;
  series?: string;
  part?: string;
  date?: string;
  url?: string;
};

// Ordinal can mean a directory row, so only an explicit episode label is shown.
export function getAdminAppearances(
  links: SourceLink[],
  sources: Source[]
): RestaurantAppearance[] {
  const byId = new Map(sources.map(source => [source.id, source]));
  const entries = new Map<string, RestaurantAppearance>();
  for (const link of links) {
    const source = byId.get(link.sourceId);
    const label = link.label?.trim() || "";
    if (
      !source ||
      !["tv_show", "creator"].includes(source.type) ||
      !(link.episodeNumber != null || /(?:\bEP\.?\s*\d+|\bepisode\s*\d+|\d+\s*회(?:차)?)/i.test(label))
    )
      continue;
    const episodeNumber = Number(
      link.episodeNumber ?? (label.match(/(?:\bEP\.?\s*|\bepisode\s*)(\d+)/i)?.[1] ||
        label.match(/(\d+)\s*회(?:차)?/)?.[1])
    );
    if (!Number.isInteger(episodeNumber) || episodeNumber < 0) continue;
    const season = Number(link.season ?? label.match(/(?:시즌\s*|\bS)(\d+)/i)?.[1] ?? 0);
    const series = link.episodeSeries?.trim() || "";
    const part = link.episodePart?.trim() || "";
    const key = `${source.id}:${season}:${episodeNumber}${series ? `:${series}` : ""}${part ? `:${part}` : ""}`;
    if (!entries.has(key))
      entries.set(key, {
        key,
        sourceId: source.id,
        sourceName: source.name,
        episode: `${series ? `${series} · ` : ""}${season ? `시즌 ${season} · ` : ""}${episodeNumber}회${part ? ` ${part}부` : ""}`,
        episodeNumber,
        season,
        series,
        part,
        date: link.broadcastDate,
        url: link.sourceUrl,
      });
  }
  return Array.from(entries.values()).sort(
    (a, b) =>
      a.sourceName.localeCompare(b.sourceName, "ko") ||
      (a.series || "").localeCompare(b.series || "", "ko") ||
      b.season - a.season ||
      b.episodeNumber - a.episodeNumber ||
      (a.part || "").localeCompare(b.part || "", "ko")
  );
}

export function groupAdminRestaurants<
  T extends {
    restaurant: { id: string };
    appearances: RestaurantAppearance[];
  },
>(entries: T[], sourceId = "", episodeKey = "") {
  const groups = new Map<
    string,
    {
      key: string;
      appearance: RestaurantAppearance | null;
      entries: T[];
    }
  >();
  for (const entry of entries) {
    const appearances = entry.appearances.filter(
      a =>
        (!sourceId || a.sourceId === sourceId) &&
        (!episodeKey || a.key === episodeKey)
    );
    for (const appearance of appearances.length ? appearances : [null]) {
      const key = appearance?.key || "unknown";
      if (!groups.has(key)) groups.set(key, { key, appearance, entries: [] });
      const group = groups.get(key)!;
      if (!group.entries.some(e => e.restaurant.id === entry.restaurant.id))
        group.entries.push(entry);
    }
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (!a.appearance) return b.appearance ? 1 : 0;
    if (!b.appearance) return -1;
    return (
      a.appearance.sourceName.localeCompare(b.appearance.sourceName, "ko") ||
      (a.appearance.series || "").localeCompare(b.appearance.series || "", "ko") ||
      b.appearance.season - a.appearance.season ||
      b.appearance.episodeNumber - a.appearance.episodeNumber ||
      (a.appearance.part || "").localeCompare(b.appearance.part || "", "ko")
    );
  });
}

export function normalizeAdminRestaurantSearch(value: string) {
  return value
    .replace(/\b(?:episode|ep)\.?\s*(\d+)/gi, "$1회")
    .replace(/[\s·]/g, "")
    .toLowerCase();
}
