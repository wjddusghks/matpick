import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { identityMatch, normalize } from "./menu-research/matching.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = async (p) =>
  JSON.parse(await fs.readFile(path.join(root, p), "utf8"));
const dir = "source-data/discovery-release-2026-09";
const [busan, tourBusan, jeju, tourJeju, official, previous, base] =
  await Promise.all(
    [
      "source-data/travel-discovery/staging/busan.json",
      "source-data/travel-discovery/staging/tourapi-26.json",
      "source-data/travel-discovery/staging/visit-jeju.json",
      "source-data/travel-discovery/staging/tourapi-50.json",
      `${dir}/broadcast-official.json`,
      "matpick_all/client/src/data/generated/jeonhyunmoo-plan.generated.json",
      "matpick_all/client/src/data/generated/public-dataset.json",
    ].map(read),
  );
const queue = [];
for (const c of busan.candidates) {
  const matches = tourBusan.candidates
    .filter(
      (t) =>
        normalize(t.name).includes(normalize(c.name)) ||
        normalize(c.name).includes(normalize(t.name)),
    )
    .filter((t) => identityMatch(c, t).accepted);
  if (matches.length !== 1 || !c.representativeMenu || c.issues.length)
    continue;
  const existing = base.restaurants.find(
    (r) =>
      normalize(r.name).includes(normalize(c.name)) &&
      identityMatch(c, r).accepted,
  );
  queue.push({
    ...c,
    id: `release_busan_${c.nativeId}`,
    kakaoPlaceId: existing?.kakaoPlaceId,
    operationState: existing?.operationState,
    releaseTopic: "busan-bite",
    crossReference: matches[0].candidateId,
  });
}
const uniqueName = (rows, name) =>
  rows.filter((c) => normalize(c.name) === normalize(name));
for (const t of tourJeju.candidates) {
  const matches = uniqueName(jeju.candidates, t.name);
  if (
    matches.length !== 1 ||
    uniqueName(tourJeju.candidates, t.name).length !== 1 ||
    !matches[0].representativeMenu ||
    t.issues.some((i) => i !== "menu_missing")
  )
    continue;
  const c = matches[0];
  queue.push({
    ...c,
    id: `release_jeju_${t.nativeId}`,
    address: t.address,
    lat: t.lat,
    lng: t.lng,
    phone: t.phone,
    releaseTopic: "jeju-bite",
    crossReference: t.candidateId,
    locationSourceUrl: "https://www.data.go.kr/data/15101578/openapi.do",
  });
}
for (const o of official.records) {
  if (!o.address) continue;
  const old = previous.restaurants.find((r) =>
    r.evidence.some(
      (e) =>
        e.season === o.season && e.restaurantRecordNo === o.restaurantRecordNo,
    ),
  );
  queue.push({
    ...o,
    id: old?.id || `release_jh_s${o.season}_${o.restaurantRecordNo}`,
    lat: old?.lat,
    lng: old?.lng,
    kakaoPlaceId: old?.kakaoPlaceId,
    releaseTopic: "jeonhyunmoo-plan",
    previousId: old?.id,
  });
}
await fs.writeFile(
  path.join(root, dir, "queue.json"),
  JSON.stringify(queue, null, 2) + "\n",
);
console.log(
  queue.reduce(
    (n, r) => ((n[r.releaseTopic] = (n[r.releaseTopic] || 0) + 1), n),
    {},
  ),
);
