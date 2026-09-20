import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateApprovedCandidate } from "./tourism-data.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (file) =>
  JSON.parse(await fs.readFile(path.join(root, file), "utf8"));
const topics = await read("source-data/travel-discovery/topics.json");
const approved = await read("source-data/travel-discovery/approved.json");
const restaurants = [],
  sourceLinks = [],
  used = new Set(),
  ids = new Set();
for (const candidate of approved) {
  validateApprovedCandidate(candidate);
  const topic = topics.find((t) => t.feed === candidate.feed);
  if (!topic) throw new Error(`Unknown feed ${candidate.feed}`);
  if (ids.has(candidate.candidateId))
    throw new Error("Duplicate approved candidate");
  ids.add(candidate.candidateId);
  const id =
    candidate.existingRestaurantId ||
    `travel_${topic.id}_${candidate.nativeId.replace(/[^\w-]/g, "_")}`;
  restaurants.push({
    id,
    name: candidate.name,
    address: candidate.address,
    lat: candidate.lat,
    lng: candidate.lng,
    region: candidate.address.split(/\s+/).slice(0, 2).join(" "),
    category: candidate.category || "음식점",
    representativeMenu: candidate.representativeMenu || "",
    menus: (candidate.menus || []).map((m, i) => ({
      ...m,
      id: `${id}_travel_menu_${i + 1}`,
    })),
    imageUrl: "",
    phone: candidate.phone || "",
    operationState: candidate.operationState,
    ...(candidate.operationState === "operating"
      ? {
          operationVerifiedAt: candidate.verification.checkedAt,
          operationSourceUrl: candidate.verification.sourceUrl,
        }
      : {}),
    locationVerifiedAt: candidate.verification.checkedAt,
    locationSourceUrls: [candidate.verification.sourceUrl],
    kakaoPlaceId: candidate.kakaoPlaceId,
    placeUrl: candidate.verification.sourceUrl,
    menuPriceVerifiedAt: candidate.menuPriceVerifiedAt,
    menuPriceSources: candidate.menuPriceSources,
  });
  sourceLinks.push({
    id: `${topic.id}:${id}`,
    sourceId: topic.id,
    restaurantId: id,
    sourceUrl: topic.attribution.url,
    note: `${topic.attribution.provider} 공개 자료 · ${candidate.nativeId}`,
  });
  used.add(topic.id);
}
const sources = topics
  .filter((t) => used.has(t.id))
  .map(({ feed, ...topic }) => topic);
for (const source of sources)
  source.imageUrl = `/source-covers/${source.id}.svg`;
const filename = path.join(
  root,
  "matpick_all/client/src/data/generated/travel-discovery.generated.json",
);
await fs.writeFile(
  filename,
  JSON.stringify({ restaurants, sources, sourceLinks }, null, 2) + "\n",
);
await fs.writeFile(
  path.join(
    root,
    "matpick_all/client/src/data/generated/travel-topic-shortcuts.generated.json",
  ),
  JSON.stringify(
    sources.map((source) => ({
      slug: source.id,
      type: "source",
      value: source.id,
      name: {
        ko: source.name,
        en: {
          "busan-bite": "Busan Bites",
          "jeju-bite": "Jeju Bites",
          "travel-bite": "Travel Bites",
        }[source.id],
      },
      imageUrl: source.imageUrl,
    })),
    null,
    2,
  ) + "\n",
);
console.log(
  `Travel discovery: ${restaurants.length} approved entries across ${sources.length} topics.`,
);
