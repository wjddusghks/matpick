import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceDir = path.resolve(projectRoot, "..", "source-data", "mogeultende");
const inputPath = path.join(sourceDir, "restaurants.json");
const outputPath = path.join(sourceDir, "kakao-places.json");
const SEARCH_ENDPOINT = "https://search.map.kakao.com/mapsearch/map.daum";
const AUTO_MATCH_THRESHOLD = 120;

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function normalize(value = "") {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/&/g, "앤드")
    .replace(/셰프/g, "쉐프")
    .replace(/[^\p{L}\p{N}]+/gu, "")
    .trim();
}

function tokenizeAddress(value = "") {
  return Array.from(
    new Set(
      value
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[(),]/g, " ")
        .match(/[\p{L}\p{N}-]+/gu) ?? []
    )
  );
}

function bigramDice(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const counts = new Map();
  for (let index = 0; index < left.length - 1; index += 1) {
    const bigram = left.slice(index, index + 2);
    counts.set(bigram, (counts.get(bigram) ?? 0) + 1);
  }

  let overlap = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const bigram = right.slice(index, index + 2);
    const count = counts.get(bigram) ?? 0;
    if (count > 0) {
      overlap += 1;
      counts.set(bigram, count - 1);
    }
  }

  return (2 * overlap) / (left.length + right.length - 2);
}

function getLocality(address = "") {
  const tokens = tokenizeAddress(address);
  if (!tokens.length) return "";

  const provinceAliases = new Map([
    ["서울특별시", "서울"],
    ["부산광역시", "부산"],
    ["대구광역시", "대구"],
    ["인천광역시", "인천"],
    ["광주광역시", "광주"],
    ["대전광역시", "대전"],
    ["울산광역시", "울산"],
    ["세종특별자치시", "세종"],
    ["경기도", "경기"],
    ["강원특별자치도", "강원"],
    ["강원도", "강원"],
    ["충청북도", "충북"],
    ["충청남도", "충남"],
    ["전북특별자치도", "전북"],
    ["전라북도", "전북"],
    ["전라남도", "전남"],
    ["경상북도", "경북"],
    ["경상남도", "경남"],
    ["제주특별자치도", "제주"],
  ]);

  const first = provinceAliases.get(tokens[0]) ?? tokens[0];
  const district = tokens.slice(1).find((token) => /[시군구]$/.test(token));
  return [first, district].filter(Boolean).join(" ");
}

function getAdministrativeToken(address = "", suffix) {
  return (
    tokenizeAddress(address)
      .slice(1)
      .find((token) => token.endsWith(suffix)) ?? ""
  );
}

function getProvince(address = "") {
  const first = tokenizeAddress(address)[0] ?? "";
  const aliases = {
    서울특별시: "서울",
    부산광역시: "부산",
    대구광역시: "대구",
    인천광역시: "인천",
    광주광역시: "광주",
    대전광역시: "대전",
    울산광역시: "울산",
    세종특별자치시: "세종",
    경기도: "경기",
    강원특별자치도: "강원",
    강원도: "강원",
    충청북도: "충북",
    충청남도: "충남",
    전북특별자치도: "전북",
    전라북도: "전북",
    전라남도: "전남",
    경상북도: "경북",
    경상남도: "경남",
    제주특별자치도: "제주",
    전남광주통합특별시: "전남광주",
  };
  return aliases[first] ?? first;
}

function provincesMatch(left, right) {
  if (left === right) return true;
  if (left === "전남광주" && ["전남", "광주"].includes(right)) return true;
  if (right === "전남광주" && ["전남", "광주"].includes(left)) return true;
  return false;
}

function scoreCandidate(restaurant, candidate) {
  const seedName = normalize(restaurant.name);
  const candidateName = normalize(candidate.name);
  let nameScore = Math.round(bigramDice(seedName, candidateName) * 100);

  if (seedName === candidateName) {
    nameScore = 150;
  } else if (
    seedName.includes(candidateName) ||
    candidateName.includes(seedName)
  ) {
    const ratio = Math.min(seedName.length, candidateName.length) /
      Math.max(seedName.length, candidateName.length);
    nameScore = Math.round(70 + ratio * 70);
  }

  const seedAddress = restaurant.officialDescriptionAddress || restaurant.address;
  const candidateAddress = [candidate.new_address, candidate.address]
    .filter(Boolean)
    .join(" ");
  const seedTokens = new Set(tokenizeAddress(seedAddress));
  const candidateTokens = new Set(tokenizeAddress(candidateAddress));
  let addressScore = 0;

  for (const token of seedTokens) {
    if (!candidateTokens.has(token)) continue;
    if (/\d/.test(token)) addressScore += 20;
    else if (/(로|길)$/.test(token)) addressScore += 25;
    else if (/(동|가|읍|면|리|구|시|군)$/.test(token)) addressScore += 12;
    else addressScore += 3;
  }
  addressScore = Math.min(addressScore, 80);

  const seedDistrict = getAdministrativeToken(seedAddress, "구");
  const candidateDistrict = getAdministrativeToken(candidateAddress, "구");
  const seedCity = getAdministrativeToken(seedAddress, "시");
  const candidateCity = getAdministrativeToken(candidateAddress, "시");
  const seedProvince = getProvince(seedAddress);
  const candidateProvince = getProvince(candidateAddress);
  let localityPenalty = 0;
  if (
    seedProvince &&
    candidateProvince &&
    !provincesMatch(seedProvince, candidateProvince)
  ) {
    localityPenalty -= 120;
  }
  if (seedDistrict && candidateDistrict && seedDistrict !== candidateDistrict) {
    localityPenalty -= 70;
  }
  if (seedCity && candidateCity && seedCity !== candidateCity) {
    localityPenalty -= 50;
  }

  return {
    total: nameScore + addressScore + localityPenalty,
    nameScore,
    addressScore,
    localityPenalty,
  };
}

async function searchKakao(query) {
  const url = new URL(SEARCH_ENDPOINT);
  url.searchParams.set("q", query);
  url.searchParams.set("msFlag", "A");
  url.searchParams.set("sort", "0");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/plain, */*",
      Referer: "https://map.kakao.com/",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Kakao search failed (${response.status}) for ${query}`);
  }

  const data = await response.json();
  return Array.isArray(data.place) ? data.place : [];
}

function toPlaceRecord(candidate, query, score) {
  const imageUrl = candidate.img
    ? candidate.img.replace(/^http:/, "https:")
    : "";

  return {
    kakaoPlaceId: String(candidate.confirmid),
    placeUrl: `https://place.map.kakao.com/${candidate.confirmid}`,
    name: candidate.name,
    address: candidate.new_address || candidate.address || "",
    parcelAddress: candidate.address || "",
    lat: Number(candidate.lat) || 0,
    lng: Number(candidate.lon) || 0,
    phone: candidate.tel || "",
    category: candidate.cate_name_depth2 || "",
    categoryDetail:
      candidate.last_cate_name || candidate.cate_name_depth3 || "",
    imageUrl,
    reviewCount: Number(candidate.reviewCount) || 0,
    rating:
      candidate.rating_average == null
        ? null
        : Number(candidate.rating_average),
    ratingCount: Number(candidate.rating_count) || 0,
    openNowRaw: candidate.openoff_status || "",
    facilities: {
      reservation: candidate.addinfo_appointment === "Y",
      delivery: candidate.addinfo_delivery === "Y",
      accessible: candidate.addinfo_fordisabled === "Y",
      takeout: candidate.addinfo_package === "Y",
      parking: candidate.addinfo_parking === "Y",
      pets: candidate.addinfo_pet === "Y",
      wifi: candidate.addinfo_wifi === "Y",
    },
    matchedQuery: query,
    matchScore: score.total,
    nameScore: score.nameScore,
    addressScore: score.addressScore,
  };
}

async function matchRestaurant(restaurant) {
  const locality = getLocality(
    restaurant.officialDescriptionAddress || restaurant.address
  );
  const queries = Array.from(
    new Set(
      [`${restaurant.name} ${locality}`.trim(), restaurant.name].filter(Boolean)
    )
  );
  const candidatesById = new Map();

  for (const query of queries) {
    const candidates = await searchKakao(query);
    for (const candidate of candidates) {
      if (!candidate?.confirmid || !candidate?.name) continue;
      const score = scoreCandidate(restaurant, candidate);
      const current = candidatesById.get(String(candidate.confirmid));
      if (!current || score.total > current.score.total) {
        candidatesById.set(String(candidate.confirmid), {
          candidate,
          query,
          score,
        });
      }
    }

    const bestSoFar = Array.from(candidatesById.values()).sort(
      (left, right) => right.score.total - left.score.total
    )[0];
    if (bestSoFar?.score.total >= AUTO_MATCH_THRESHOLD + 35) break;
    await sleep(40);
  }

  const ranked = Array.from(candidatesById.values()).sort(
    (left, right) => right.score.total - left.score.total
  );
  const best = ranked[0];
  if (best?.score.total >= AUTO_MATCH_THRESHOLD) {
    return {
      match: toPlaceRecord(best.candidate, best.query, best.score),
      candidates: ranked,
    };
  }

  return { match: null, candidates: ranked };
}

async function main() {
  const source = JSON.parse(await fs.readFile(inputPath, "utf8"));
  const domestic = source.restaurants.filter((restaurant) => !restaurant.isOverseas);
  const restaurants = {};
  const unmatched = [];
  const reviewNeeded = [];

  for (const [index, restaurant] of domestic.entries()) {
    try {
      const result = await matchRestaurant(restaurant);
      if (result.match) {
        restaurants[restaurant.id] = result.match;
        if (result.match.matchScore < AUTO_MATCH_THRESHOLD + 20) {
          reviewNeeded.push({
            id: restaurant.id,
            name: restaurant.name,
            address: restaurant.officialDescriptionAddress || restaurant.address,
            selected: result.match,
          });
        }
      } else {
        unmatched.push({
          id: restaurant.id,
          name: restaurant.name,
          address: restaurant.officialDescriptionAddress || restaurant.address,
          candidates: result.candidates.slice(0, 3).map(({ candidate, query, score }) => ({
            kakaoPlaceId: String(candidate.confirmid),
            name: candidate.name,
            address: candidate.new_address || candidate.address || "",
            query,
            ...score,
          })),
        });
      }
    } catch (error) {
      unmatched.push({
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.officialDescriptionAddress || restaurant.address,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if ((index + 1) % 20 === 0 || index + 1 === domestic.length) {
      console.log(
        `Processed ${index + 1}/${domestic.length}: ${Object.keys(restaurants).length} matched, ${unmatched.length} unmatched`
      );
    }
    await sleep(60);
  }

  const output = {
    source: "Kakao Maps public place search",
    collectedAt: new Date().toISOString(),
    autoMatchThreshold: AUTO_MATCH_THRESHOLD,
    domesticRestaurantCount: domestic.length,
    matchedCount: Object.keys(restaurants).length,
    unmatchedCount: unmatched.length,
    reviewNeededCount: reviewNeeded.length,
    restaurants,
    reviewNeeded,
    unmatched,
  };

  await fs.writeFile(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(`Wrote ${outputPath}`);
}

await main();
