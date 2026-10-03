import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  nameKeys,
  normalizeName,
  sameAddress,
} from "../../scripts/topic-publication/identity.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..");
const workspaceRoot = path.resolve(projectRoot, "..");
const sourceDir = path.join(workspaceRoot, "source-data", "community-picks");
const defaultInputs = [
  path.join(sourceDir, "workbook-normalized.json"),
  path.join(sourceDir, "naver-normalized.json"),
];
const inputPaths = process.argv.slice(2).length
  ? process.argv.slice(2).map((filename) => path.resolve(filename))
  : defaultInputs;
const outputPath = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "generated",
  "community-picks.generated.json",
);
const publicDatasetPath = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "generated",
  "public-dataset.json",
);
const reportPath = path.join(
  projectRoot,
  "reports",
  "community-picks-import.json",
);
const coordinatePath = path.join(sourceDir, "coordinates.json");
const exclusionsPath = path.join(sourceDir, "naver-exclusions.json");

const SOURCE_ID = "community-picks";
const MAX_MATCH_DISTANCE_METERS = 100;

const normalizeText = (value) =>
  String(value ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim();

const stableHash = (value, length = 16) =>
  createHash("sha256").update(String(value)).digest("hex").slice(0, length);

const readJson = async (filename, fallback = null) => {
  try {
    return JSON.parse(await readFile(filename, "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT" && fallback !== null) return fallback;
    throw error;
  }
};

const safeUrl = (value) => {
  try {
    const url = new URL(normalizeText(value));
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
};

const numericCoordinate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function distanceMeters(left, right) {
  const coordinates = [left.lat, left.lng, right.lat, right.lng].map(Number);
  if (coordinates.some((value) => !Number.isFinite(value) || value === 0)) {
    return Infinity;
  }
  const [aLat, aLng, bLat, bLng] = coordinates;
  const radians = (value) => (value * Math.PI) / 180;
  const deltaLat = radians(bLat - aLat);
  const deltaLng = radians(bLng - aLng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(aLat)) *
      Math.cos(radians(bLat)) *
      Math.sin(deltaLng / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function namesMatch(left, right) {
  const leftKeys = new Set(nameKeys(left.name, left.address));
  const rightKeys = nameKeys(right.name, right.address);
  if (rightKeys.some((key) => leftKeys.has(key))) return true;
  return [...leftKeys].some((leftKey) =>
    rightKeys.some((rightKey) => {
      const shorter = Math.min(leftKey.length, rightKey.length);
      const longer = Math.max(leftKey.length, rightKey.length);
      return (
        shorter >= 3 &&
        shorter / longer >= 0.65 &&
        (leftKey.includes(rightKey) || rightKey.includes(leftKey))
      );
    }),
  );
}

function nameKeySetsMatch(leftKeys, rightKeys) {
  if (rightKeys.some((key) => leftKeys.has(key))) return true;
  return [...leftKeys].some((leftKey) =>
    rightKeys.some((rightKey) => {
      const shorter = Math.min(leftKey.length, rightKey.length);
      const longer = Math.max(leftKey.length, rightKey.length);
      return (
        shorter >= 3 &&
        shorter / longer >= 0.65 &&
        (leftKey.includes(rightKey) || rightKey.includes(leftKey))
      );
    }),
  );
}

function identitiesMatch(left, right) {
  const leftPlaceId = normalizeText(left.placeId || left.naverPlaceId);
  const rightPlaceId = normalizeText(right.placeId || right.naverPlaceId);
  if (leftPlaceId && rightPlaceId && leftPlaceId === rightPlaceId) return true;
  if (!namesMatch(left, right)) return false;
  return (
    (left.address && right.address && sameAddress(left.address, right.address)) ||
    distanceMeters(left, right) <= MAX_MATCH_DISTANCE_METERS
  );
}

function formatPrice(value) {
  const text = normalizeText(value);
  if (!text) return undefined;
  if (/^\d+$/.test(text)) {
    return `${Number(text).toLocaleString("ko-KR")}원`;
  }
  return text;
}

function normalizeMenus(row) {
  const rawMenus = Array.isArray(row.menus)
    ? row.menus
    : Array.isArray(row.menuPrices)
      ? row.menuPrices
      : row.menu || row.menuName
        ? [{ name: row.menu || row.menuName, price: row.price }]
        : [];
  const seen = new Set();
  return rawMenus.flatMap((menu) => {
    const item = typeof menu === "string" ? { name: menu } : menu || {};
    const name = normalizeText(item.name || item.menu || item.menuName);
    const normalizedName = normalizeName(name);
    const price = formatPrice(item.price ?? item.menuPrice);
    const priceText = normalizeText(item.priceText);
    const conditions = normalizeText(item.conditions);
    const note = normalizeText(item.note || item.description);
    const evidenceType = normalizeText(item.evidenceType);
    const description = [
      !price && priceText ? priceText : "",
      conditions,
      note,
      evidenceType && !/네이버 표시 가격/.test(evidenceType)
        ? `근거: ${evidenceType}`
        : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const key = [normalizedName, price || "", conditions, priceText].join("|");
    if (!normalizedName || seen.has(key)) return [];
    seen.add(key);
    return [
      {
        name,
        ...(price ? { price } : {}),
        ...(description ? { description } : {}),
        ...(item.isSignature || item.isRecommended
          ? { isSignature: true }
          : {}),
      },
    ];
  });
}

function normalizeProvenance(row, defaults = {}) {
  const raw = row.provenance || {};
  const kind = normalizeText(
    raw.kind || row.sourceKind || defaults.kind || "curated-list",
  );
  const title = normalizeText(
    raw.title ||
      row.sourceTitle ||
      defaults.title ||
      (kind === "excel" ? "추천 식당 조사 자료" : "추천 식당 목록"),
  );
  const url = safeUrl(raw.url || row.sourceUrl || defaults.url);
  return { kind, title, ...(url ? { url } : {}) };
}

function normalizeInputRow(row, index, defaults, coordinateLookup) {
  const name = normalizeText(row.name || row.restaurantName);
  const address = normalizeText(row.address || row.location);
  const sourceEntryId = normalizeText(row.sourceEntryId || row.entryId || row.id);
  const placeId = normalizeText(row.placeId || row.naverPlaceId);
  const coordinateOverride =
    coordinateLookup.byEntryId.get(sourceEntryId) ||
    coordinateLookup.byPlaceId.get(placeId) ||
    coordinateLookup.byIdentity.get(
      `${normalizeName(name)}|${normalizeName(address)}`,
    );
  const lat = numericCoordinate(
    row.lat ?? row.latitude ?? row.y ?? coordinateOverride?.lat,
  );
  const lng = numericCoordinate(
    row.lng ?? row.longitude ?? row.x ?? coordinateOverride?.lng,
  );
  const provenance = normalizeProvenance(row, defaults);
  const fallbackKey = stableHash(
    [name, address, lat.toFixed(7), lng.toFixed(7), provenance.title, provenance.url]
      .join("|"),
  );
  return {
    sourceEntryId: sourceEntryId || fallbackKey,
    existingRestaurantId: normalizeText(row.existingRestaurantId),
    placeId,
    name,
    address,
    region: normalizeText(row.region),
    category: normalizeText(row.category) || "음식점",
    representativeMenu: normalizeText(row.representativeMenu),
    lat,
    lng,
    menus: normalizeMenus(row),
    menuSourceUrls: [
      ...new Set(
        (Array.isArray(row.menus) ? row.menus : [])
          .map((menu) => safeUrl(menu?.sourceUrl))
          .filter(Boolean),
      ),
    ],
    checkedAt: normalizeText(row.checkedAt),
    researchStatus: normalizeText(row.researchStatus),
    reviewNote: normalizeText(row.reviewNote),
    blockNewReason: normalizeText(row.blockNewReason),
    provenance,
    inputOrdinal: index + 1,
  };
}

function protectedRestaurantDigest(restaurant) {
  const protectedValues = {
    address: restaurant.address,
    lat: restaurant.lat,
    lng: restaurant.lng,
    representativeMenu: restaurant.representativeMenu,
    menus: (restaurant.menus || []).map(
      ({ name, price, description, isSignature }) => ({
        name,
        ...(price ? { price } : {}),
        ...(description ? { description } : {}),
        ...(isSignature ? { isSignature: true } : {}),
      }),
    ),
    menuPriceStatus: restaurant.menuPriceStatus,
    menuPriceVerifiedAt: restaurant.menuPriceVerifiedAt,
    menuPriceNote: restaurant.menuPriceNote,
    menuPriceSources: restaurant.menuPriceSources,
  };
  return stableHash(JSON.stringify(protectedValues), 64);
}

function deriveRegion(address) {
  return normalizeText(address).split(" ").filter(Boolean).slice(0, 2).join(" ");
}

function mergeMenus(rows) {
  const menus = new Map();
  for (const row of rows) {
    for (const menu of row.menus) {
      const key = [
        normalizeName(menu.name),
        menu.price || "",
        menu.description || "",
      ].join("|");
      const current = menus.get(key);
      if (!current) {
        menus.set(key, { ...menu });
      } else if (!current.price && menu.price) {
        menus.set(key, { ...current, price: menu.price });
      }
    }
  }
  return [...menus.values()];
}

function buildNewRestaurant(rows, restaurantId) {
  const primary = [...rows].sort(
    (left, right) =>
      Number(Boolean(right.lat && right.lng)) -
        Number(Boolean(left.lat && left.lng)) ||
      Number(Boolean(right.address)) - Number(Boolean(left.address)) ||
      right.menus.length - left.menus.length ||
      left.sourceEntryId.localeCompare(right.sourceEntryId, "ko"),
  )[0];
  const menus = mergeMenus(rows);
  const representativeMenu =
    rows.map((row) => row.representativeMenu).find(Boolean) ||
    menus
      .slice(0, 3)
      .map((menu) => menu.name)
      .join(" · ");
  const verifiedAt = rows
    .map((row) => row.checkedAt.slice(0, 10))
    .filter(Boolean)
    .sort()
    .at(-1);
  const menuPriceSources = [
    ...new Map(
      rows
        .flatMap((row) => [
          row.provenance.url
            ? { url: row.provenance.url, label: row.provenance.title }
            : null,
          ...row.menuSourceUrls.map((url) => ({
            url,
            label: "메뉴 가격 출처",
          })),
        ])
        .filter(Boolean)
        .map((source) => [source.url, source]),
    ).values(),
  ];
  const menuPriceNote = rows.map((row) => row.reviewNote).find(Boolean);
  const researchStatuses = [
    ...new Set(rows.map((row) => row.researchStatus).filter(Boolean)),
  ];
  return {
    id: restaurantId,
    name: primary.name,
    region: primary.region || deriveRegion(primary.address),
    address: primary.address,
    category: primary.category,
    representativeMenu,
    lat: primary.lat,
    lng: primary.lng,
    imageUrl: "",
    ...(menus.length
      ? {
          menus: menus.map((menu, index) => ({
            id: `${restaurantId}_menu_${String(index + 1).padStart(3, "0")}`,
            ...menu,
          })),
          menuPriceStatus:
            researchStatuses.join(" / ") || "추천 원본에 메뉴 기록 있음",
          ...(verifiedAt ? { menuPriceVerifiedAt: verifiedAt } : {}),
          menuPriceNote: [
            researchStatuses.length
              ? `원본 조사 상태: ${researchStatuses.join(" / ")}`
              : "",
            menuPriceNote,
            "메뉴와 가격은 원본 수집 시점 기준이며 방문 전 확인이 필요합니다.",
          ]
            .filter(Boolean)
            .join(" "),
          ...(menuPriceSources.length ? { menuPriceSources } : {}),
        }
      : {}),
  };
}

function buildRestaurantId(row) {
  const identity = row.placeId
    ? `naver:${row.placeId}`
    : `${normalizeName(row.name)}|${normalizeName(row.address)}|${row.lat.toFixed(5)}|${row.lng.toFixed(5)}`;
  return `community_pick_${stableHash(identity)}`;
}

function provenanceKey(provenance) {
  return `${provenance.kind}|${provenance.title}|${provenance.url || ""}`;
}

function provenanceDisplayName(provenance) {
  if (provenance.kind === "redribbon-workbook") return "레드리본 조사 목록";
  if (provenance.kind === "naver-shared-list") return "재슐랭 가이드 맵";
  return provenance.title;
}

function buildSourceLink(restaurantId, provenance, ordinal) {
  const key = `${restaurantId}|${provenanceKey(provenance)}`;
  return {
    id: `community_pick_link_${stableHash(key)}`,
    restaurantId,
    sourceId: SOURCE_ID,
    ordinal,
    label: `추천식당 · ${provenanceDisplayName(provenance)}`,
    note: `원본 유형: ${provenance.kind}`,
    ...(provenance.url ? { sourceUrl: provenance.url } : {}),
  };
}

async function main() {
  const [rawInputs, publicDataset, previousOutput, previousReport, coordinateEntries, exclusions] = await Promise.all([
    Promise.all(inputPaths.map((filename) => readJson(filename))),
    readJson(publicDatasetPath),
    readJson(outputPath, { restaurants: [], importMeta: {} }),
    readJson(reportPath, { entryRestaurantIds: {} }),
    readJson(coordinatePath, []),
    readJson(exclusionsPath, { excluded: [] }),
  ]);
  const coordinateLookup = {
    byEntryId: new Map(),
    byPlaceId: new Map(),
    byIdentity: new Map(),
  };
  for (const entry of coordinateEntries) {
    if (entry.sourceEntryId)
      coordinateLookup.byEntryId.set(normalizeText(entry.sourceEntryId), entry);
    if (entry.placeId || entry.naverPlaceId)
      coordinateLookup.byPlaceId.set(
        normalizeText(entry.placeId || entry.naverPlaceId),
        entry,
      );
    if (entry.name && entry.address)
      coordinateLookup.byIdentity.set(
        `${normalizeName(entry.name)}|${normalizeName(entry.address)}`,
        entry,
      );
  }
  const inputRows = rawInputs.flatMap((rawInput, inputIndex) => {
    const records = Array.isArray(rawInput)
      ? rawInput
      : rawInput.restaurants || rawInput.entries || [];
    const defaults = Array.isArray(rawInput) ? {} : rawInput.provenance || {};
    return records.map((row, rowIndex) => ({
      row,
      defaults,
      inputOrdinal: `${inputIndex + 1}:${rowIndex + 1}`,
    }));
  });
  const rows = inputRows
    .map(({ row, defaults, inputOrdinal }, index) => ({
      ...normalizeInputRow(row, index, defaults, coordinateLookup),
      inputOrdinal,
    }))
    .sort((left, right) =>
      left.sourceEntryId.localeCompare(right.sourceEntryId, "ko"),
    );

  const errors = [];
  const seenEntryIds = new Set();
  for (const row of rows) {
    if (!row.name) errors.push(`행 ${row.inputOrdinal}: 식당명이 없습니다.`);
    if (!row.sourceEntryId)
      errors.push(`행 ${row.inputOrdinal}: sourceEntryId가 없습니다.`);
    if (seenEntryIds.has(row.sourceEntryId))
      errors.push(`중복 sourceEntryId: ${row.sourceEntryId}`);
    seenEntryIds.add(row.sourceEntryId);
    if (
      (row.lat !== 0 || row.lng !== 0) &&
      (Math.abs(row.lat) > 90 || Math.abs(row.lng) > 180)
    ) {
      errors.push(`행 ${row.inputOrdinal}: 좌표 범위가 잘못되었습니다.`);
    }
  }

  const previousNewIds = new Set(
    (previousOutput.restaurants || []).map((restaurant) => restaurant.id),
  );
  const catalog = (publicDataset.restaurants || []).filter(
    (restaurant) => !previousNewIds.has(restaurant.id),
  );
  const catalogById = new Map(catalog.map((restaurant) => [restaurant.id, restaurant]));
  const sourceLinkCountByRestaurantId = new Map();
  for (const link of publicDataset.sourceLinks || []) {
    sourceLinkCountByRestaurantId.set(
      link.restaurantId,
      (sourceLinkCountByRestaurantId.get(link.restaurantId) || 0) + 1,
    );
  }
  const existingCandidateScore = (restaurant) =>
    (sourceLinkCountByRestaurantId.get(restaurant.id) || 0) * 10_000 +
    Number(Boolean(restaurant.kakaoPlaceId)) * 1_000 +
    Number(Boolean(restaurant.phone)) * 500 +
    (restaurant.menus?.length || 0) * 10 +
    Number(!restaurant.id.startsWith("topic_enrichment_"));
  const catalogIdentities = catalog.map((restaurant) => ({
    restaurant,
    nameKeys: nameKeys(restaurant.name, restaurant.address),
  }));
  const previousEntryMap = {
    ...(previousReport.entryRestaurantIds || {}),
    ...(previousOutput.importMeta?.entryRestaurantIds || {}),
  };
  const resolveCatalogAlias = (restaurantId) => {
    let current = normalizeText(restaurantId);
    if (!current.startsWith("community_pick_")) return null;
    const seen = new Set();
    let followedAlias = false;
    while (publicDataset.restaurantAliases?.[current] && !seen.has(current)) {
      seen.add(current);
      current = publicDataset.restaurantAliases[current];
      followedAlias = true;
    }
    return followedAlias ? catalogById.get(current) || null : null;
  };
  const groups = new Map();
  const entryRestaurantIds = {};
  const matchedExisting = [];
  const ambiguous = [];
  const duplicateCatalogMatches = [];
  const targetByPlaceId = new Map();

  for (const row of rows) {
    let target = null;
    let matchBasis = "";
    const previousId = previousEntryMap[row.sourceEntryId];
    const placeIdTarget = row.placeId ? targetByPlaceId.get(row.placeId) : null;
    if (placeIdTarget?.kind === "existing") {
      target = catalogById.get(placeIdTarget.restaurantId) || null;
      if (target) matchBasis = "same_input_place_id_as_existing_match";
    } else if (row.existingRestaurantId) {
      target = catalogById.get(row.existingRestaurantId);
      if (!target) {
        errors.push(
          `${row.sourceEntryId}: existingRestaurantId를 찾을 수 없습니다: ${row.existingRestaurantId}`,
        );
        continue;
      }
      matchBasis = "explicit_existing_restaurant_id";
    } else {
      target = resolveCatalogAlias(previousId);
      if (target) matchBasis = "previous_import_alias_to_existing";
      const rowNameKeys = new Set(nameKeys(row.name, row.address));
      if (!target) {
        const candidates = catalogIdentities
          .filter(({ nameKeys: candidateKeys }) =>
            nameKeySetsMatch(rowNameKeys, candidateKeys),
          )
          .map(({ restaurant }) => restaurant)
          .filter((restaurant) => identitiesMatch(row, restaurant));
        if (candidates.length === 1) {
          [target] = candidates;
          matchBasis =
            row.address && sameAddress(row.address, target.address)
              ? "same_name_and_address"
              : "same_name_within_100m";
        } else if (candidates.length > 1) {
          const ranked = [...candidates].sort(
            (left, right) =>
              existingCandidateScore(right) - existingCandidateScore(left) ||
              left.id.localeCompare(right.id),
          );
          [target] = ranked;
          matchBasis = "duplicate_catalog_identity_preferred_canonical";
          duplicateCatalogMatches.push({
            sourceEntryId: row.sourceEntryId,
            name: row.name,
            address: row.address,
            selectedId: target.id,
            candidateIds: ranked.map((candidate) => candidate.id),
          });
        }
      }
    }

    if (target) {
      if (row.placeId) {
        targetByPlaceId.set(row.placeId, {
          kind: "existing",
          restaurantId: target.id,
        });
      }
      entryRestaurantIds[row.sourceEntryId] = target.id;
      matchedExisting.push({
        sourceEntryId: row.sourceEntryId,
        restaurantId: target.id,
        matchBasis,
        payloadDigest: stableHash(JSON.stringify(target), 64),
        protectedDigest: protectedRestaurantDigest(target),
      });
      const group = groups.get(target.id) || { kind: "existing", rows: [] };
      group.rows.push(row);
      groups.set(target.id, group);
      continue;
    }

    let newRestaurantId = placeIdTarget?.kind === "new"
      ? placeIdTarget.restaurantId
      : previousNewIds.has(previousId) ? previousId : "";
    if (!newRestaurantId) {
      const matchedGroup = [...groups.entries()].find(
        ([, group]) =>
          group.kind === "new" && group.rows.some((candidate) => identitiesMatch(row, candidate)),
      );
      newRestaurantId = matchedGroup?.[0] || buildRestaurantId(row);
    }
    entryRestaurantIds[row.sourceEntryId] = newRestaurantId;
    const group = groups.get(newRestaurantId) || { kind: "new", rows: [] };
    group.rows.push(row);
    groups.set(newRestaurantId, group);
    if (row.placeId) {
      targetByPlaceId.set(row.placeId, {
        kind: "new",
        restaurantId: newRestaurantId,
      });
    }
  }

  const pending = [];
  const pendingRestaurantIds = new Set();
  for (const [restaurantId, group] of groups) {
    if (group.kind !== "new") continue;
    const restaurant = buildNewRestaurant(group.rows, restaurantId);
    const reasons = [];
    if (group.rows.every((row) => row.blockNewReason))
      reasons.push(
        ...new Set(group.rows.map((row) => row.blockNewReason).filter(Boolean)),
      );
    if (!restaurant.address) reasons.push("새 식당에 주소가 없습니다.");
    if (!restaurant.lat || !restaurant.lng)
      reasons.push("새 식당에 유효한 좌표가 없습니다.");
    if (reasons.length) {
      pendingRestaurantIds.add(restaurantId);
      pending.push({
        restaurantId,
        sourceEntryIds: group.rows.map((row) => row.sourceEntryId),
        name: restaurant.name,
        address: restaurant.address,
        reasons,
      });
    }
  }

  const publishedEntryRestaurantIds = Object.fromEntries(
    Object.entries(entryRestaurantIds).filter(
      ([, restaurantId]) => !pendingRestaurantIds.has(restaurantId),
    ),
  );
  const newCandidateCount = [...groups.values()].filter(
    (group) => group.kind === "new",
  ).length;
  const newRestaurantCount = newCandidateCount - pending.length;

  const report = {
    schemaVersion: 1,
    sourceId: SOURCE_ID,
    inputFiles: inputPaths.map((filename) =>
      path.relative(workspaceRoot, filename).replaceAll("\\", "/"),
    ),
    inputEntries: rows.length,
    excludedNonRestaurants: (exclusions.excluded || []).length,
    canonicalRestaurants: groups.size,
    matchedExisting: matchedExisting.length,
    newCandidates: newCandidateCount,
    newRestaurants: newRestaurantCount,
    pendingCount: pending.length,
    errors,
    ambiguous,
    duplicateCatalogMatches,
    pending,
    matches: matchedExisting,
    entryRestaurantIds,
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  if (errors.length || ambiguous.length) {
    throw new Error(
      `추천식당 import 중단: 오류 ${errors.length}건, 중복 후보 검토 ${ambiguous.length}건. ${reportPath} 확인`,
    );
  }

  const restaurants = [];
  const sourceLinks = [];
  let linkOrdinal = 1;
  for (const [restaurantId, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    if (pendingRestaurantIds.has(restaurantId)) continue;
    if (group.kind === "new") {
      restaurants.push(buildNewRestaurant(group.rows, restaurantId));
    }
    const provenances = new Map(
      group.rows.map((row) => [provenanceKey(row.provenance), row.provenance]),
    );
    for (const provenance of [...provenances.values()].sort((left, right) =>
      provenanceKey(left).localeCompare(provenanceKey(right), "ko"),
    )) {
      sourceLinks.push(buildSourceLink(restaurantId, provenance, linkOrdinal++));
    }
  }

  const output = {
    sources: [
      {
        id: SOURCE_ID,
        name: "추천식당",
        type: "guide",
        provider: "Matpick",
        description:
          "맛픽 추천 목록에 등록된 식당입니다. 메뉴와 가격은 수집 시점 기준이며 방문 전 확인해 주세요.",
        imageUrl: "/source-covers/community-picks.svg",
        importedAt: "2026-10-03T17:20:00+09:00",
      },
    ],
    restaurants,
    sourceLinks,
    importMeta: {
      schemaVersion: 1,
      inputFiles: report.inputFiles,
      entryRestaurantIds: publishedEntryRestaurantIds,
    },
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`);
  console.log(
    `추천식당 ${rows.length}개 입력 → 기존 ${report.matchedExisting}개 연결, 신규 ${report.newRestaurants}개 생성, 보류 ${report.pendingCount}개, 출처 연결 ${sourceLinks.length}개`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
