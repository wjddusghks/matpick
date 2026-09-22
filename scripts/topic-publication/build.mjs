import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { topics } from "./topics.mjs";
import {
  sameIdentity,
  sameAddress,
  hasPublishableEvidence,
  nameKeys,
  safeSourceUrl,
} from "./identity.mjs";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const dir = path.join(root, "source-data/topic-publication-2026-09-22");
const read = async (name) =>
  JSON.parse(await fs.readFile(path.join(dir, name), "utf8"));
const input = await read("candidates.json"),
  baseline = await read("catalog-baseline.json"),
  manual = await read("manual-associations.json");
const restaurants = baseline.restaurants,
  byName = new Map(),
  byId = new Map(restaurants.map((r) => [r.id, r]));
for (const r of restaurants)
  for (const key of nameKeys(r.name, r.address)) {
    if (!byName.has(key)) byName.set(key, []);
    byName.get(key).push(r);
  }
const excluded = new Set(
  JSON.parse(
    await fs.readFile(
      path.join(root, "matpick_all/client/src/data/restaurant-exclusions.json"),
      "utf8",
    ),
  ).restaurantIds,
);
const eligible = (r) =>
  r &&
  !excluded.has(r.id) &&
  !r.recommendationHold &&
  !/폐업|영업종료/.test(r.name + " " + (r.operationStatus || "")) &&
  !["closed", "moved", "temporarily_closed"].includes(r.operationState) &&
  r.lat > 33 &&
  r.lat < 39 &&
  r.lng > 124 &&
  r.lng < 132;
const hash = (s) => createHash("sha256").update(s).digest("hex").slice(0, 12);
const links = new Map(),
  decisions = [];
for (const c of input.records) {
  const operationConflict =
    [
      "registry_closed_at_address",
      "floor_or_unit_conflict_review",
      "registry_active_with_closed_history",
    ].includes(c.registryStatus) || c.conflictCount > 0;
  const alternatives =
    c.registryStatus === "registry_active"
      ? c.registry.flatMap((e) => [e.roadAddress, e.parcelAddress])
      : [];
  const matches = [
    ...new Map(
      nameKeys(c.name, c.address)
        .flatMap((key) => byName.get(key) || [])
        .filter((r) => eligible(r) && sameIdentity(c, r, alternatives))
        .map((r) => [r.id, r]),
    ).values(),
  ];
  let restaurantId = matches.length === 1 ? matches[0].id : null;
  const approved = [];
  if (restaurantId && !operationConflict) {
    for (const rank of c.topicRanks) {
      const evidence = c.evidence
        .filter(
          (e) =>
            hasPublishableEvidence(e, rank) &&
            ((e.sourceKind === "official-detail" && !e.name && !e.address) ||
              sameIdentity(e, matches[0], alternatives)),
        )
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      if (evidence.length)
        approved.push({ rank, restaurantId, evidence: evidence[0] });
    }
  }
  for (const m of manual.filter((m) => m.candidateId === c.id)) {
    const r = byId.get(m.restaurantId);
    assert.ok(
      !operationConflict && eligible(r) && sameAddress(m.address, r.address),
      `Manual identity conflict: ${c.name}`,
    );
    assert.ok(safeSourceUrl(m.sourceUrl) && safeSourceUrl(m.identitySourceUrl));
    const evidence = c.evidence.find(
      (e) => e.sourceUrl === m.sourceUrl && e.topicRank === m.topicRank,
    );
    assert.ok(
      m.topicRank === 10 || evidence,
      `Missing original evidence for ${c.name}`,
    );
    assert.ok(m.topicRank !== 10 || m.chefName, `Missing chef for ${c.name}`);
    approved.push({
      rank: m.topicRank,
      restaurantId: r.id,
      evidence: {
        ...evidence,
        sourceUrl: m.sourceUrl,
        publishedAt: m.publishedAt || evidence?.publishedAt || "",
        chefName: m.chefName,
      },
    });
    restaurantId = r.id;
  }
  const ranks = [...new Set(approved.map((a) => a.rank))];
  const reason = operationConflict
    ? "operation_review"
    : ranks.length === c.topicRanks.length
      ? "published"
      : ranks.length
        ? "partly_published"
        : restaurantId
          ? "source_review"
          : "identity_review";
  decisions.push({ id: c.id, restaurantId, publishedRanks: ranks, reason });
  for (const a of approved) {
    const sourceId = topics.find((t) => t.rank === a.rank).id;
    const key = `${sourceId}:${a.restaurantId}`;
    const sourceUrl = safeSourceUrl(a.evidence.sourceUrl);
    const label =
      a.rank === 10
        ? `${a.evidence.chefName} 셰프 · 2024년 소개 이력`
        : a.evidence.publishedAt.match(/\d{4}[-.]\d{2}[-.]\d{2}/)?.[0] ||
          "소개 기록";
    const link = {
      id: `census_${hash(key)}`,
      restaurantId: a.restaurantId,
      sourceId,
      label,
      sourceUrl,
    };
    // Several episodes/candidate spellings may refer to the same branch. One
    // public source association; every original reference stays in the queue.
    if (!links.has(key) || label > links.get(key).label) links.set(key, link);
  }
}
const sourceLinks = [...links.values()];
const candidateById = new Map(input.records.map((c) => [c.id, c]));
const sources = topics.map((t) => ({
  id: t.id,
  name: t.name,
  type: t.type,
  provider: t.provider,
  imageUrl: `/source-covers/${t.id}.svg`,
  description:
    t.rank === 10
      ? "흑백요리사 출연 셰프와 관련된 식당의 소개 이력입니다. 식당의 방송 출연이나 셰프의 현재 재직을 뜻하지 않습니다."
      : "공식 영상·방송 게시물의 상호와 주소를 기존 맛픽 식당 정보와 대조했습니다. 소개 당시 기록이며 현재 영업·메뉴·가격은 방문 전 확인해 주세요.",
}));
const shortcuts = topics.map((t) => ({
  slug: t.id,
  type: "source",
  value: t.id,
  name: { ko: t.rank === 10 ? "흑백요리사 셰프" : t.name, en: t.en },
  imageUrl: `/source-covers/${t.id}.svg`,
}));
const summary = {
  asOf: input.asOf,
  updatedAt: "2026-09-22",
  complete: false,
  candidateRows: input.records.length,
  publishedCandidateRows: decisions.filter((r) => r.publishedRanks.length)
    .length,
  fullyPublishedRows: decisions.filter((r) => r.reason === "published").length,
  pendingCandidateRows: decisions.filter((r) => r.reason !== "published")
    .length,
  uniquePublishedRestaurants: new Set(sourceLinks.map((l) => l.restaurantId))
    .size,
  sourceAssociations: sourceLinks.length,
  newRestaurants: 0,
  topics: topics.map((t) => ({
    rank: t.rank,
    id: t.id,
    name: t.name,
    candidateRows: input.records.filter((c) => c.topicRanks.includes(t.rank))
      .length,
    publishedRestaurants: sourceLinks.filter((l) => l.sourceId === t.id).length,
    pendingRows: decisions.filter(
      (d) =>
        candidateById.get(d.id)?.topicRanks.includes(t.rank) &&
        !d.publishedRanks.includes(t.rank),
    ).length,
  })),
  reasons: Object.fromEntries(
    [...new Set(decisions.map((d) => d.reason))].map((key) => [
      key,
      decisions.filter((d) => d.reason === key).length,
    ]),
  ),
};
assert.equal(summary.candidateRows, 22117);
assert.ok(
  summary.topics.every((t) => t.publishedRestaurants > 0),
  "Every new topic needs at least one verified association",
);
const write = async (p, value) =>
  fs.writeFile(path.join(root, p), JSON.stringify(value) + "\n");
await write(
  "matpick_all/client/src/data/generated/researched-topics.generated.json",
  { sources, sourceLinks, restaurants: [] },
);
await write(
  "matpick_all/client/src/data/generated/researched-topic-shortcuts.generated.json",
  shortcuts,
);
await write("source-data/topic-publication-2026-09-22/publication.json", {
  summary,
  decisions,
});
await fs.writeFile(
  path.join(dir, "summary.json"),
  JSON.stringify(summary, null, 2) + "\n",
);
const escape = (s) =>
  s.replace(
    /[<>&"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[c],
  );
for (const t of topics) {
  const lines = t.cover.split("|");
  const text = lines
    .map(
      (line, i) =>
        `<text x="80" y="${lines.length === 1 ? 87 : 68 + i * 34}" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="${line.length > 3 ? 27 : 31}" fill="white">${escape(line)}</text>`,
    )
    .join("");
  await fs.writeFile(
    path.join(root, `matpick_all/client/public/source-covers/${t.id}.svg`),
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160"><title>${escape(t.name)} 맛픽 주제</title><rect width="160" height="160" rx="80" fill="${t.color}"/><circle cx="80" cy="80" r="70" fill="none" stroke="white" opacity=".25"/>${text}</svg>\n`,
  );
}
console.log(JSON.stringify(summary, null, 2));
