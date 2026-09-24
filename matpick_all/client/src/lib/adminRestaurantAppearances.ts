import type { Source, SourceLink } from "@/data/types";

export type RestaurantAppearance = {
  key: string;
  sourceId: string;
  sourceName: string;
  episode: string;
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
      !/(?:\bEP\.?\s*\d+|\bepisode\s*\d+|\d+\s*회(?:차)?)/i.test(label)
    )
      continue;
    const key = `${source.id}:${label}`;
    if (!entries.has(key))
      entries.set(key, {
        key,
        sourceId: source.id,
        sourceName: source.name,
        episode: label,
        date: link.broadcastDate,
        url: link.sourceUrl,
      });
  }
  return Array.from(entries.values()).sort(
    (a, b) =>
      a.sourceName.localeCompare(b.sourceName, "ko") ||
      a.episode.localeCompare(b.episode, "ko", { numeric: true })
  );
}

export function normalizeAdminRestaurantSearch(value: string) {
  return value
    .replace(/\b(?:episode|ep)\.?\s*(\d+)/gi, "$1회")
    .replace(/\s/g, "")
    .toLowerCase();
}
