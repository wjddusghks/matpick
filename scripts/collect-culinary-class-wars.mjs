import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputRoot = path.join(root, "source-data", "culinary-class-wars");

const SOURCE_URLS = {
  season1Official:
    "https://www.netflix.com/tudum/articles/culinary-class-wars-season-1-release-date-news",
  season1Directory: "https://ryoojin2.tistory.com/m/8592",
  season2Official:
    "https://about.netflix.com/en/news/culinary-class-wars-season-2-premieres-december-16",
  season2WhiteDirectory: "https://www.oddy.kr/white-spoon",
  season2BlackDirectory: "https://www.oddy.kr/black-spoon",
};

function decodeHtml(value) {
  const entities = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
  };
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => entities[name.toLowerCase()] ?? all);
}

function cleanHtml(value, separator = " ") {
  return decodeHtml(
    String(value ?? "")
      .replace(/<br\s*\/?\s*>/gi, separator)
      .replace(/<\/p\s*>/gi, separator)
      .replace(/<\/div\s*>/gi, separator)
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

function slug(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function absoluteUrl(href, baseUrl) {
  try {
    return new URL(decodeHtml(href), baseUrl).href;
  } catch {
    return decodeHtml(href);
  }
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; MatpickResearch/1.0; +https://example.invalid)",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${url}`);
  }
  return response.text();
}

function parseChefIdentity(value) {
  const text = cleanHtml(value);
  const classMatch = text.match(/\((흑수저|백수저)\)/);
  const spoonClass = classMatch?.[1] === "백수저" ? "white" : "black";
  const beforeClass = classMatch ? text.slice(0, classMatch.index).trim() : text;
  const afterClass = classMatch
    ? text.slice((classMatch.index ?? 0) + classMatch[0].length).trim()
    : "";
  return {
    contestantName: beforeClass,
    chefName: afterClass || beforeClass,
    spoonClass,
  };
}

function parseRestaurantAnchors(cell, baseUrl) {
  const anchors = [...cell.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const result = [];

  for (let index = 0; index < anchors.length; index += 1) {
    const match = anchors[index];
    const name = cleanHtml(match[2]);
    if (!name || name.length > 80) continue;

    const afterStart = (match.index ?? 0) + match[0].length;
    const afterEnd = anchors[index + 1]?.index ?? cell.length;
    const trailing = cleanHtml(cell.slice(afterStart, afterEnd), "\n");
    const address = trailing
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    result.push({
      name,
      address,
      listingUrl: absoluteUrl(match[1], baseUrl),
    });
  }

  return result;
}

function parseSeason1(html) {
  const records = [];
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
  let participantOrdinal = 0;

  for (const rowMatch of rows) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (match) => match[1]
    );
    if (cells.length < 4 || !/(?:흑수저|백수저)/.test(cleanHtml(cells[2]))) continue;

    participantOrdinal += 1;
    const rankText = cleanHtml(cells[0]);
    const identity = parseChefIdentity(cells[2]);
    const restaurants = parseRestaurantAnchors(cells[3], SOURCE_URLS.season1Directory);
    const category = cleanHtml(cells[4] ?? "");

    for (let restaurantOrdinal = 0; restaurantOrdinal < restaurants.length; restaurantOrdinal += 1) {
      const restaurant = restaurants[restaurantOrdinal];
      records.push({
        id: `culinary-class-wars-s1-${participantOrdinal}-${restaurantOrdinal + 1}`,
        season: 1,
        participantOrdinal,
        rankLabel: rankText || null,
        ...identity,
        restaurantName: restaurant.name,
        region: restaurant.address.split(" ").slice(0, 2).join(" "),
        address: restaurant.address,
        category,
        representativeMenu: "",
        role: "operator-or-affiliated-chef",
        listingUrl: restaurant.listingUrl,
        sourceUrl: SOURCE_URLS.season1Directory,
        officialCastSourceUrl: SOURCE_URLS.season1Official,
        lat: null,
        lng: null,
        confidence: restaurant.address ? 0.8 : 0.65,
        reviewStatus: restaurant.address ? "secondary-source-reviewed" : "needs-review",
        notes: "출연진과 식당의 현재 운영·재직 여부는 게시 전 재확인 필요",
      });
    }
  }

  return { records, participantCount: participantOrdinal };
}

function headingBlocks(html) {
  const headings = [...html.matchAll(/<h([23])\b[^>]*>([\s\S]*?)<\/h\1>/gi)];
  return headings.map((heading, index) => ({
    level: Number(heading[1]),
    text: cleanHtml(heading[2]),
    inner: heading[2],
    start: heading.index ?? 0,
    bodyStart: (heading.index ?? 0) + heading[0].length,
    bodyEnd: headings[index + 1]?.index ?? html.length,
    body: html.slice((heading.index ?? 0) + heading[0].length, headings[index + 1]?.index ?? html.length),
  }));
}

function extractFirstLink(html, baseUrl, preferredPattern) {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(
    (match) => ({ href: absoluteUrl(match[1], baseUrl), label: cleanHtml(match[2]) })
  );
  return links.find((link) => preferredPattern.test(link.href)) ?? links[0] ?? null;
}

function parseSeason2Directory(html, spoonClass, sourceUrl) {
  const records = [];
  const headings = headingBlocks(html);
  let currentChef = "";
  let ordinal = 0;

  for (const heading of headings) {
    if (heading.level === 2) {
      const chefMatch = heading.text.match(/^(.+?)(?:\s+셰프)?\s+\d+\s*개\s*식당$/);
      currentChef =
        chefMatch?.[1]?.trim() ??
        (heading.text === "온라인 예약 준비중" ? heading.text : "");
      continue;
    }
    if (heading.level !== 3 || !currentChef) continue;
    if (/자주 묻는 질문|상세 소개|기타 /.test(heading.text)) continue;

    const bodyText = decodeHtml(
      heading.body
        .replace(/<br\s*\/?\s*>/gi, "\n")
        .replace(/<\/(?:p|div|li)\s*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    );
    const lines = bodyText
      .split(/\n+/)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    const listing = extractFirstLink(heading.body, sourceUrl, /map\.naver|naver\.me|catchtable/i);
    const isGenericGroup = /기타|온라인 예약/.test(currentChef);
    const contestantName =
      spoonClass === "black" && !isGenericGroup ? lines[0] ?? currentChef : currentChef;
    const regionCategory =
      lines[spoonClass === "black" && !isGenericGroup ? 1 : 0] ?? "";
    const representativeLine = lines.find((line) => line.startsWith("대표 ")) ?? "";
    const region = regionCategory?.split(" ")[0] ?? "";
    const category = regionCategory?.split(" ").slice(1).join(" ") ?? "";
    const inferredChefByRestaurant = {
      "회현카페": "김건",
      "카덴": "정호영",
      "천상현의 천상": "천상현",
      "우동카덴": "정호영",
      "우동 카덴": "정호영",
    };
    const chefName = inferredChefByRestaurant[heading.text] ?? currentChef;

    ordinal += 1;
    records.push({
      id: `culinary-class-wars-s2-${spoonClass}-${ordinal}`,
      season: 2,
      participantOrdinal: null,
      rankLabel: null,
      contestantName:
        isGenericGroup && !inferredChefByRestaurant[heading.text]
          ? "공개 디렉터리에서 식당별 확인 필요"
          : contestantName === currentChef
            ? chefName
            : contestantName,
      chefName,
      spoonClass,
      restaurantName: heading.text,
      region,
      address: "",
      category,
      representativeMenu: representativeLine.replace(/^대표\s*/, ""),
      role: "operator-or-affiliated-chef",
      listingUrl: listing?.href ?? "",
      sourceUrl,
      officialCastSourceUrl: SOURCE_URLS.season2Official,
      lat: null,
      lng: null,
      confidence: 0.65,
      reviewStatus: "needs-address-review",
      notes: "보조 출처에 상세 도로명 주소가 없어 매장 링크로 검수 필요",
    });
  }

  return records;
}

function uniqueBy(records, keyFn) {
  const result = [];
  const seen = new Set();
  for (const record of records) {
    const key = keyFn(record);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }
  return result;
}

function isPublicRestaurant(record) {
  if (/\(폐업\)/.test(record.address)) return false;
  if (/^(?:유튜버|인스타그램|학교급식|케이터링|한식연구소)$/.test(record.category)) {
    return false;
  }
  if (/youtube\.com|\bx\.com\b/i.test(record.listingUrl)) return false;
  return true;
}

async function main() {
  const [season1Html, season2WhiteHtml, season2BlackHtml] = await Promise.all([
    fetchText(SOURCE_URLS.season1Directory),
    fetchText(SOURCE_URLS.season2WhiteDirectory),
    fetchText(SOURCE_URLS.season2BlackDirectory),
  ]);

  const season1 = parseSeason1(season1Html);
  const season2White = parseSeason2Directory(
    season2WhiteHtml,
    "white",
    SOURCE_URLS.season2WhiteDirectory
  );
  const season2Black = parseSeason2Directory(
    season2BlackHtml,
    "black",
    SOURCE_URLS.season2BlackDirectory
  );
  const allAffiliations = uniqueBy(
    [...season1.records, ...season2White, ...season2Black],
    (record) =>
      `${record.season}|${record.chefName}|${record.restaurantName}|${record.address}`.toLowerCase()
  );
  const restaurants = allAffiliations.filter(isPublicRestaurant);
  const chefsWithoutCurrentRestaurant = allAffiliations.filter((record) => !isPublicRestaurant(record));

  const sources = [
    {
      id: "ccw-s1-netflix",
      season: 1,
      type: "official-cast",
      publisher: "Netflix Tudum",
      url: SOURCE_URLS.season1Official,
    },
    {
      id: "ccw-s1-directory",
      season: 1,
      type: "secondary-restaurant-directory",
      publisher: "류진창2",
      url: SOURCE_URLS.season1Directory,
    },
    {
      id: "ccw-s2-netflix",
      season: 2,
      type: "official-cast",
      publisher: "About Netflix",
      url: SOURCE_URLS.season2Official,
    },
    {
      id: "ccw-s2-white-directory",
      season: 2,
      type: "secondary-restaurant-directory",
      publisher: "ODDY",
      url: SOURCE_URLS.season2WhiteDirectory,
    },
    {
      id: "ccw-s2-black-directory",
      season: 2,
      type: "secondary-restaurant-directory",
      publisher: "ODDY",
      url: SOURCE_URLS.season2BlackDirectory,
    },
  ];

  const meta = {
    generatedAt: new Date().toISOString(),
    capturedAt: new Date().toISOString().slice(0, 10),
    scope:
      "시즌 1은 100인 목록의 식당 연결, 시즌 2는 백수저 및 2라운드 진출 흑수저 공개 식당 목록",
    season1ParticipantRowsParsed: season1.participantCount,
    season1RestaurantCount: season1.records.length,
    season2WhiteRestaurantCount: season2White.length,
    season2BlackRestaurantCount: season2Black.length,
    totalRestaurantAffiliations: restaurants.length,
    nonPublicOrClosedAffiliations: chefsWithoutCurrentRestaurant.length,
    caveats: [
      "출연 이력은 넷플릭스 공식 출처, 식당 연결은 보조 디렉터리 출처를 사용했다.",
      "시즌 2 흑수저는 2라운드 진출자 식당 중심으로, 80인 전원 목록이 아니다.",
      "현재 운영·폐업·이전·셰프 재직 여부는 실제 게시 직전 재확인해야 한다.",
    ],
  };

  const report = `# 흑백요리사 셰프 식당 근거 보고서\n\n` +
    `- 수집일: ${meta.capturedAt}\n` +
    `- 시즌 1 참가자 행 파싱: ${meta.season1ParticipantRowsParsed}명\n` +
    `- 시즌 1 식당 연결: ${meta.season1RestaurantCount}건\n` +
    `- 시즌 2 백수저 식당: ${meta.season2WhiteRestaurantCount}건\n` +
    `- 시즌 2 2라운드 진출 흑수저 식당: ${meta.season2BlackRestaurantCount}건\n` +
    `- 총 셰프-식당 연결: ${meta.totalRestaurantAffiliations}건\n\n` +
    `- 비공개 시설·폐업·유튜브 등 분리 보관: ${meta.nonPublicOrClosedAffiliations}건\n\n` +
    `## 게시 전 필수 검수\n\n` +
    `1. 매장별 최신 운영 여부와 도로명 주소를 확인한다.\n` +
    `2. 셰프가 현재도 해당 매장을 운영하거나 조리를 책임지는지 확인한다.\n` +
    `3. \`needs-address-review\`는 링크만 확보된 항목이므로 주소 검수 후에만 공개한다.\n` +
    `4. 가격과 예약 정보는 변동성이 크므로 원문에서 직접 노출하지 않는다.\n`;

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputRoot, "restaurants.json"), `${JSON.stringify(restaurants, null, 2)}\n`, "utf8"),
    writeFile(
      path.join(outputRoot, "chefs-without-current-restaurant.json"),
      `${JSON.stringify(chefsWithoutCurrentRestaurant, null, 2)}\n`,
      "utf8"
    ),
    writeFile(path.join(outputRoot, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputRoot, "meta.json"), `${JSON.stringify(meta, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputRoot, "evidence-report.md"), report, "utf8"),
  ]);

  console.log(JSON.stringify(meta, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
