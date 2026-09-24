import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { sameIdentity, nameKeys } from "./identity.mjs";
import { topics } from "./topics.mjs";

const indexNames = (records) => {
  const index = new Map();
  for (const r of records)
    for (const key of nameKeys(r.name, r.address)) {
      if (!index.has(key)) index.set(key, []);
      index.get(key).push(r);
    }
  return index;
};
const distinct = (values) => [...new Set(values)];
const findIdentity = (row, index) => [
  ...new Map(
    nameKeys(row.name, row.address)
      .flatMap((key) => index.get(key) || [])
      .filter((r) => sameIdentity(row, r))
      .map((r) => [r.id, r]),
  ).values(),
];
const operationConflict = (row) =>
  [
    "registry_closed_at_address",
    "floor_or_unit_conflict_review",
    "registry_active_with_closed_history",
  ].includes(row.registryStatus) || row.conflictCount > 0;
const unavailable = (r) =>
  r.recommendationHold ||
  ["closed", "moved", "temporarily_closed"].includes(r.operationState) ||
  /폐업|영업종료/.test(`${r.name} ${r.operationStatus || ""}`);

// This reconciles review work; it never publishes a restaurant or edits source evidence.
export function reconcileResearch({
  records,
  decisions,
  catalog,
  deletions,
  topicList = topics,
}) {
  const byId = new Map(catalog.restaurants.map((r) => [r.id, r]));
  const catalogNames = indexNames(catalog.restaurants);
  const removedNames = indexNames(deletions);
  const removedIds = new Set(deletions.map((r) => r.id));
  const oldDecisions = new Map(decisions.map((d) => [d.id, d]));
  const ranksBySource = new Map(topicList.map((t) => [t.id, t.rank]));
  const ranksByRestaurant = new Map();
  for (const link of catalog.sourceLinks) {
    const rank = ranksBySource.get(link.sourceId);
    if (!rank || !byId.has(link.restaurantId)) continue;
    if (!ranksByRestaurant.has(link.restaurantId))
      ranksByRestaurant.set(link.restaurantId, new Set());
    ranksByRestaurant.get(link.restaurantId).add(rank);
  }
  const groups = [],
    byResolvedId = new Map(),
    unlinkedNames = new Map();
  for (const row of records) {
    const previous = oldDecisions.get(row.id);
    const oldId = previous?.restaurantId;
    const canonicalId = catalog.restaurantAliases?.[oldId] || oldId;
    const removed =
      removedIds.has(oldId) || findIdentity(row, removedNames).length > 0;
    const matches = findIdentity(row, catalogNames);
    // A previously approved link remains the same restaurant after an address correction.
    if (
      !removed &&
      previous?.publishedRanks.length &&
      byId.has(canonicalId) &&
      !matches.length
    )
      matches.push(byId.get(canonicalId));
    const restaurantId =
      !removed && matches.length === 1 ? matches[0].id : null;
    const resolvedKey = restaurantId ? `catalog:${restaurantId}` : null;
    let group = resolvedKey ? byResolvedId.get(resolvedKey) : null;
    if (!resolvedKey) {
      const possible = distinct(
        nameKeys(row.name, row.address).flatMap(
          (key) => unlinkedNames.get(key) || [],
        ),
      );
      // Require pairwise branch agreement; an address without a floor cannot bridge conflicting units.
      group = possible.find(
        (g) =>
          g.removed === removed &&
          g.members.every((member) => sameIdentity(row, member)),
      );
    }
    if (!group) {
      group = {
        id: row.id,
        members: [],
        restaurantId,
        removed,
        ambiguous: matches.length > 1,
      };
      groups.push(group);
      if (resolvedKey) byResolvedId.set(resolvedKey, group);
      else
        for (const key of nameKeys(row.name, row.address)) {
          if (!unlinkedNames.has(key)) unlinkedNames.set(key, []);
          unlinkedNames.get(key).push(group);
        }
    }
    group.members.push(row);
  }
  const output = groups.map((group) => {
    const topicRanks = distinct(
      group.members.flatMap((r) => r.topicRanks),
    ).sort((a, b) => a - b);
    const currentRanks = ranksByRestaurant.get(group.restaurantId) || new Set();
    const publishedRanks = topicRanks.filter((rank) => currentRanks.has(rank));
    const pendingRanks = topicRanks.filter((rank) => !currentRanks.has(rank));
    const restaurant = byId.get(group.restaurantId);
    const possibleMatches =
      restaurant || group.removed
        ? []
        : [
            ...new Map(
              group.members
                .flatMap((row) =>
                  nameKeys(row.name, row.address).flatMap(
                    (key) => catalogNames.get(key) || [],
                  ),
                )
                .map((r) => [
                  r.id,
                  { id: r.id, name: r.name, address: r.address },
                ]),
            ).values(),
          ];
    const conflict =
      group.members.some(operationConflict) ||
      (restaurant && unavailable(restaurant));
    const reason = group.removed
      ? "excluded"
      : conflict
        ? "operation_review"
        : !restaurant
          ? "identity_review"
          : pendingRanks.length
            ? "source_review"
            : "published";
    const catalogState = group.removed
      ? "excluded"
      : restaurant
        ? pendingRanks.length
          ? "existing_needs_topic"
          : "already_linked"
        : group.ambiguous
          ? "ambiguous"
          : possibleMatches.length
            ? "possible_existing"
            : "unmatched";
    return {
      id: group.id,
      rowIds: group.members.map((r) => r.id),
      topicRanks,
      publication: {
        restaurantId: group.restaurantId,
        publishedRanks,
        pendingRanks,
        reason,
        catalogState,
        duplicateRows: group.members.length - 1,
        currentName: restaurant?.name || null,
        currentAddress: restaurant?.address || null,
        possibleMatches: possibleMatches.slice(0, 3),
        possibleMatchCount: possibleMatches.length,
      },
    };
  });
  const pending = output.filter(
    (g) => !["published", "excluded"].includes(g.publication.reason),
  );
  const reasons = Object.fromEntries(
    [
      "published",
      "identity_review",
      "source_review",
      "operation_review",
      "excluded",
    ].map((reason) => [
      reason,
      output.filter((g) => g.publication.reason === reason).length,
    ]),
  );
  return {
    groups: output,
    summary: {
      candidateRows: records.length,
      candidateGroups: output.length,
      duplicateRows: records.length - output.length,
      pendingCandidateRows: pending.length,
      alreadyLinkedGroups: output.filter(
        (g) => g.publication.reason === "published",
      ).length,
      existingNeedsTopicGroups: output.filter(
        (g) => g.publication.catalogState === "existing_needs_topic",
      ).length,
      excludedGroups: reasons.excluded,
      possibleExistingGroups: output.filter(
        (g) => g.publication.catalogState === "possible_existing",
      ).length,
      reasons,
      uniquePublishedRestaurants: ranksByRestaurant.size,
      sourceAssociations: [...ranksByRestaurant.values()].reduce(
        (n, s) => n + s.size,
        0,
      ),
      topics: topicList.map((t) => ({
        ...t,
        candidateRows: records.filter((r) => r.topicRanks.includes(t.rank))
          .length,
        candidateGroups: output.filter((g) => g.topicRanks.includes(t.rank))
          .length,
        pendingRows: pending.filter(
          (g) =>
            g.topicRanks.includes(t.rank) &&
            (g.publication.reason !== "source_review" ||
              g.publication.pendingRanks.includes(t.rank)),
        ).length,
        publishedRestaurants: [...ranksByRestaurant.values()].filter((s) =>
          s.has(t.rank),
        ).length,
      })),
    },
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../..",
  );
  const read = async (p) =>
    JSON.parse(await fs.readFile(path.join(root, p), "utf8"));
  const dir = "source-data/topic-publication-2026-09-22";
  const [input, previous, catalog, deleted] = await Promise.all([
    read(`${dir}/candidates.json`),
    read(`${dir}/publication.json`),
    read("matpick_all/client/src/data/generated/public-dataset.json"),
    read("matpick_all/client/src/data/restaurant-permanent-deletions.json"),
  ]);
  const result = reconcileResearch({
    records: input.records,
    decisions: previous.decisions,
    catalog,
    deletions: deleted.restaurants,
  });
  result.summary.updatedAt = new Date().toISOString().slice(0, 10);
  result.summary.researchAsOf = previous.summary.updatedAt;
  result.summary.catalogDigest = createHash("sha256")
    .update(JSON.stringify(catalog))
    .digest("hex");
  await fs.writeFile(
    path.join(root, dir, "review-state.json"),
    JSON.stringify(result) + "\n",
  );
  console.log(
    JSON.stringify(
      { ...result.summary, topics: undefined, catalogDigest: undefined },
      null,
      2,
    ),
  );
}
