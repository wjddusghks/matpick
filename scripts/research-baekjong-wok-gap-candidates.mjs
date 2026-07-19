import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const inputPath = path.join(root, "source-data", "baekjong-wok", "menu-prices.json");
const outputPath = path.join(
  root,
  "source-data",
  "baekjong-wok",
  "gap-candidate-research-2026-07-19.json"
);
const searchEndpoint = "https://search.map.kakao.com/mapsearch/map.daum";
const panelEndpoint = "https://place-api.map.kakao.com/places/panel3";
const targetStatuses = new Set(["unmatched", "matched_no_priced_menu"]);

const headers = {
  Accept: "application/json, text/plain, */*",
  Referer: "https://map.kakao.com/",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/146 Safari/537.36",
};

const panelHeaders = {
  ...headers,
  appVersion: "6.6.0",
  Origin: "https://place.map.kakao.com",
  pf: "PC",
};

const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalize(value = "") {
  return String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/[()\[\]{}.,]/g, " ")
    .replace(/[^\p{L}\p{N}-]+/gu, "")
    .trim();
}

function addressParts(address = "") {
  const parenthetical = String(address).match(/\(([^)]+)\)/)?.[1]?.trim() ?? "";
  const road = String(address).replace(/\s*\([^)]*\)\s*$/, "").trim();
  const locality = road.split(/\s+/).slice(0, 2).join(" ");
  return { road, parenthetical, locality };
}

function buildQueries(restaurant) {
  const { road, parenthetical, locality } = addressParts(restaurant.address);
  return Array.from(new Set([
    road,
    parenthetical ? `${locality} ${parenthetical}` : "",
    `${restaurant.name} ${road}`,
    `${restaurant.name} ${locality}`,
    restaurant.name,
  ].filter(Boolean)));
}

async function fetchJson(url, requestHeaders) {
  const response = await fetch(url, {
    headers: requestHeaders,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
  return response.json();
}

async function search(query) {
  const url = new URL(searchEndpoint);
  url.searchParams.set("q", query);
  url.searchParams.set("msFlag", "A");
  url.searchParams.set("sort", "0");
  const payload = await fetchJson(url, headers);
  return Array.isArray(payload.place) ? payload.place : [];
}

function compactCandidate(candidate, query, restaurant) {
  const expectedAddress = normalize(restaurant.address);
  const candidateAddress = normalize(`${candidate.new_address ?? ""} ${candidate.address ?? ""}`);
  const expectedName = normalize(restaurant.name);
  const candidateName = normalize(candidate.name);
  const addressExact = Boolean(expectedAddress && candidateAddress && (
    candidateAddress.includes(expectedAddress) || expectedAddress.includes(candidateAddress)
  ));
  const nameRelated = Boolean(expectedName && candidateName && (
    candidateName.includes(expectedName) || expectedName.includes(candidateName)
  ));
  return {
    kakaoPlaceId: String(candidate.confirmid),
    name: candidate.name ?? "",
    roadAddress: candidate.new_address ?? "",
    parcelAddress: candidate.address ?? "",
    phone: candidate.tel ?? "",
    category: candidate.last_cate_name ?? candidate.cate_name_depth2 ?? "",
    query,
    addressExact,
    nameRelated,
  };
}

async function fetchPanel(placeId) {
  const panel = await fetchJson(`${panelEndpoint}/${placeId}`, panelHeaders);
  const summary = panel.summary ?? {};
  const menu = panel.menu?.menus ?? {};
  return {
    kakaoPlaceId: String(placeId),
    name: summary.name ?? "",
    roadAddress: summary.address?.road ?? "",
    parcelAddress: summary.address?.jibun ?? summary.address?.disp ?? "",
    phone: summary.phone_numbers?.[0]?.tel ?? "",
    status: summary.status ?? "",
    category: summary.category?.catname ?? "",
    menuUpdatedAt: menu.items_updated_at ?? "",
    menus: (menu.items ?? []).map((item) => ({
      name: String(item?.name ?? "").trim(),
      price: Number(item?.price) > 0 ? `${Number(item.price).toLocaleString("ko-KR")}원` : "",
      sourceUpdatedAt: String(item?.mod_at ?? "").trim(),
    })).filter((item) => item.name),
  };
}

async function main() {
  const source = JSON.parse((await fs.readFile(inputPath, "utf8")).replace(/^\uFEFF/, ""));
  const targets = Object.entries(source.restaurants ?? {})
    .filter(([, restaurant]) => targetStatuses.has(restaurant.status));
  const results = [];

  for (const [index, [id, restaurant]] of targets.entries()) {
    const byId = new Map();
    const errors = [];
    for (const query of buildQueries(restaurant)) {
      try {
        for (const candidate of await search(query)) {
          if (!candidate?.confirmid || !candidate?.name) continue;
          const compact = compactCandidate(candidate, query, restaurant);
          const previous = byId.get(compact.kakaoPlaceId);
          if (!previous || Number(compact.addressExact) + Number(compact.nameRelated) > Number(previous.addressExact) + Number(previous.nameRelated)) {
            byId.set(compact.kakaoPlaceId, compact);
          }
        }
      } catch (error) {
        errors.push(`${query}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(45);
    }

    const candidates = [...byId.values()]
      .sort((left, right) =>
        Number(right.addressExact) - Number(left.addressExact) ||
        Number(right.nameRelated) - Number(left.nameRelated)
      )
      .slice(0, 15);
    const panelCandidateIds = candidates
      .filter((candidate) => candidate.addressExact || candidate.nameRelated)
      .slice(0, 6)
      .map((candidate) => candidate.kakaoPlaceId);
    if (restaurant.kakaoPlaceId && !panelCandidateIds.includes(String(restaurant.kakaoPlaceId))) {
      panelCandidateIds.unshift(String(restaurant.kakaoPlaceId));
    }
    const panels = [];
    for (const placeId of panelCandidateIds) {
      try {
        panels.push(await fetchPanel(placeId));
      } catch (error) {
        errors.push(`${placeId}: ${error instanceof Error ? error.message : String(error)}`);
      }
      await sleep(45);
    }

    results.push({ id, name: restaurant.name, address: restaurant.address, currentStatus: restaurant.status, candidates, panels, errors });
    console.log(`${index + 1}/${targets.length} ${restaurant.name}: ${candidates.length} candidates, ${panels.length} panels`);
  }

  await fs.writeFile(outputPath, `${JSON.stringify({ collectedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8");
  console.log(outputPath);
}

await main();
