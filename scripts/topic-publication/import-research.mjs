import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { safeSourceUrl } from "./identity.mjs";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const input = path.join(root, "source-data/topic-census-2026-09-22");
const output = path.join(root, "source-data/topic-publication-2026-09-22");
const read = async (name) =>
  JSON.parse(await fs.readFile(path.join(input, name), "utf8"));
const candidates = await read("consolidated-candidates.json");
const verification = await read("candidate-verification.json");
const menuAudit = await read("menu-attribution-audit.json");
const byId = new Map(verification.records.map((r) => [r.candidateId, r]));
const menus = new Map(menuAudit.records.map((r) => [r.candidateId, r]));
const clean = (value) =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();
const rows = candidates.candidates.map((c) => {
  const v = byId.get(c.id);
  return {
    id: c.id,
    name: c.name,
    address: c.address,
    topicRanks: c.topicRanks,
    menuLabels: c.menuLabels,
    menuClues: [...new Set([...c.menuMentions, ...c.sectionMenuMentions])],
    historicalPrices: c.historicalPriceMentions,
    menuStatus: menus.get(c.id)?.status || "no_explicit_menu",
    registryStatus: v.status,
    registry: v.identityEvidence.map((e) => ({
      id: e["관리번호"],
      name: e["사업장명"],
      roadAddress: e["도로명주소"],
      parcelAddress: e["지번주소"],
      status: e["영업상태명"],
      detail: e["상세영업상태명"],
      closedAt: e["폐업일자"],
      snapshotDate: e.snapshotDownloadedAt,
      url: safeSourceUrl(e.sourceUrl),
    })),
    conflictCount: v.conflicts.length,
    evidence: c.evidence.map((e) => ({
      topicRank: e.topicRank,
      sourceUrl: safeSourceUrl(e.sourceUrl || e.url),
      sourceKind: e.sourceKind || "official_broadcast_body",
      episodeId: e.episodeId || "",
      name: e.name || "",
      address: e.address || "",
      sourceTitle: clean(e.sourceTitle || e.label || e.visibleProgram),
      publishedAt: e.publishedAt || "",
      checkedAt: e.checkedAt || e.observedAt || "",
      nameBasis: e.nameBasis || "",
      nameVerification: e.nameVerification || "",
      locationClue: e.locationClue || "",
      menuLabels: e.menuLabels || [],
      hasCorrectionOrOperationNote: !!e.hasCorrectionOrOperationNote,
      chefName: e.chefName || "",
      contestantName: e.contestantName || "",
      season: e.season || null,
    })),
  };
});
await fs.mkdir(output, { recursive: true });
// Only factual identity/menu fragments and provenance. No full descriptions,
// transcripts, comments, telephone contacts, credentials or author identifiers.
await fs.writeFile(
  path.join(output, "candidates.json"),
  JSON.stringify({
    version: 1,
    asOf: candidates.asOf,
    complete: false,
    records: rows,
  }) + "\n",
);
const catalog = JSON.parse(
  await fs.readFile(
    path.join(
      root,
      "matpick_all/client/src/data/generated/public-dataset.json",
    ),
    "utf8",
  ),
);
await fs.writeFile(
  path.join(output, "catalog-baseline.json"),
  JSON.stringify({
    commit: "d1ad6e1ca96d3fb8bf5ddfe9106c9273eda982ed",
    restaurants: catalog.restaurants.map((r) => ({
      id: r.id,
      name: r.name,
      address: r.address,
      lat: r.lat,
      lng: r.lng,
      operationState: r.operationState,
      operationStatus: r.operationStatus,
      recommendationHold: r.recommendationHold,
    })),
  }) + "\n",
);
console.log(
  JSON.stringify({
    candidateRows: rows.length,
    bytes: (await fs.stat(path.join(output, "candidates.json"))).size,
  }),
);
