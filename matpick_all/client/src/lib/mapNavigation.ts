/** Keep the map's browsing position in its URL so back navigation restores it. */
export function readMapView(search: string) {
  const params = new URLSearchParams(search);
  const shown = Number(params.get("shown"));
  return {
    selectedId: params.get("selected") || null,
    visibleCount:
      Number.isFinite(shown) && shown >= 6
        ? Math.min(3000, Math.floor(shown))
        : 6,
  };
}

export function withMapView(
  search: string,
  selectedId: string | null,
  visibleCount: number
) {
  const params = new URLSearchParams(search);
  if (selectedId) params.set("selected", selectedId);
  else params.delete("selected");
  if (visibleCount > 6) params.set("shown", String(visibleCount));
  else params.delete("shown");
  return `/map?${params}`;
}

export function getTopicFilterPath(search: string, sourceId: string | null) {
  const params = new URLSearchParams(search);
  const type = params.get("type") || "all";
  params.delete("selected");
  params.delete("shown");
  if (["all", "source", "creator"].includes(type)) {
    params.set("type", sourceId ? "source" : "all");
    if (sourceId) params.set("value", sourceId);
    else params.delete("value");
    params.delete("source");
    params.delete("topic");
  } else if (sourceId) {
    params.set("source", sourceId);
  } else {
    params.delete("source");
  }
  return `/map?${params}`;
}

export function isComposingSearch(event: {
  isComposing?: boolean;
  keyCode?: number;
}) {
  // Safari may report Enter with keyCode 229 while committing a Korean syllable.
  return event.isComposing === true || event.keyCode === 229;
}
