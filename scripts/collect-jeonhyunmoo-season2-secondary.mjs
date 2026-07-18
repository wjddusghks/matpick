import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputRoot = path.join(root, "source-data", "jeonhyunmoo-plan", "season-2");
const directoryUrl = "https://i2m.haedory.com/2024/10/2.html";
const officialProgramUrl = "https://www.mbn.co.kr/vod/programMain/983";

function decodeHtml(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => entities[name.toLowerCase()] ?? all);
}

function stripHtml(value) {
  return decodeHtml(String(value ?? "").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function htmlLines(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:p|div|li|td|h\d|blockquote)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 MatpickResearch/1.0" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return { url: response.url, html: await response.text() };
}

function headingBlocks(html) {
  const headings = [...html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi)];
  return headings.map((heading, index) => {
    const bodyStart = (heading.index ?? 0) + heading[0].length;
    const bodyEnd = headings[index + 1]?.index ?? html.length;
    return {
      label: stripHtml(heading[1]),
      body: html.slice(bodyStart, bodyEnd),
    };
  });
}

function firstRestaurantLink(html, baseUrl) {
  const anchors = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const preferred = anchors.find((match) => /맛집 정보/.test(stripHtml(match[2])));
  const fallback = anchors.find((match) =>
    /(?:nopo\.haedory\.com|map\.naver\.com|m\.site\.naver\.com)/i.test(match[1])
  );
  const match = preferred ?? fallback;
  if (!match) return "";
  try {
    return new URL(decodeHtml(match[1]), baseUrl).href;
  } catch {
    return decodeHtml(match[1]);
  }
}

function parseIndex(html, baseUrl) {
  return headingBlocks(html)
    .filter(
      (block) =>
        block.label &&
        !/^(?:목차|관련|자주 묻는 질문|함께 읽어보세요)/.test(block.label) &&
        !/섭외 거절/.test(block.label)
    )
    .map((block) => ({
      directoryLabel: block.label,
      description: stripHtml(block.body).slice(0, 700),
      sourceUrl: firstRestaurantLink(block.body, baseUrl),
    }))
    .filter((entry) => entry.sourceUrl);
}

function valueFromText(text, labels) {
  for (const label of labels) {
    const match = text.match(new RegExp(`${label}\\s*[:：]\\s*([^\\n]{1,160})`, "i"));
    if (match) return match[1].replace(/\s+/g, " ").trim();
  }
  return "";
}

function inferRegion(label, address) {
  const addressMatch = address.match(
    /^((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\s]*)(?:\s+(\S+[시군구]))?/
  );
  if (addressMatch) return [addressMatch[1], addressMatch[2]].filter(Boolean).join(" ");
  return label.split(" ").slice(0, 2).join(" ");
}

function inferCategory(label, representativeMenu) {
  const text = `${label} ${representativeMenu}`;
  if (/빵|제과|제빵|챐빵|팩빙수/.test(text)) return "베이커리·디저트";
  if (/중국집|짬뽕|짜장|탕수육|중화/.test(text)) return "중식";
  if (/냉면|막국수|소바|우동|일식|회정식/.test(text)) return "면요리·일식";
  if (/소고기|한우|갈비|삼겹살|고기|족발|곡창/.test(text)) return "고기요리";
  if (/물회|꽃게|굴비|덕자|민어|생선|장어|밴댕이|회 /.test(text)) return "해산물";
  if (/국밥|해장국|고기국수|고탕|닭곰탕/.test(text)) return "국밥·탕";
  return "한식·로컬음식";
}

function parseDetail(entry, html, resolvedUrl) {
  const lines = htmlLines(html);
  const text = lines.join("\n");
  const name =
    valueFromText(text, ["식당 이름", "상호", "업체명", "가게 이름"]) ||
    "";
  const address = valueFromText(text, ["주소", "식당 주소", "위치"])
    .replace(/(?:\s*(?:찾아가는 길|전화|영업시간)\s*:.*)$/i, "")
    .trim();
  const phone =
    valueFromText(text, ["전화", "연락처", "전화번호"]).match(
      /(?:0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})/
    )?.[0] ?? text.match(/(?:0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})/)?.[0] ?? "";
  const episode =
    Number(text.match(/전현무계획2\s*(\d{1,2})\s*(?:회|화)/)?.[1] ?? 0) || null;
  const menus = [];
  const seen = new Set();
  for (const line of lines) {
    const match = line.match(/^(.{1,60}?)\s*[:：]\s*([\d,]+)원(?:\s|$)/);
    if (!match || /(?:주소|전화|영업시간|주차)/.test(match[1])) continue;
    const menuName = match[1].replace(/^[*\-•\s]+/, "").trim();
    const key = `${menuName}|${match[2]}`;
    if (menuName && !seen.has(key)) {
      seen.add(key);
      menus.push({ name: menuName, price: `${match[2]}원`, isSignature: menus.length === 0 });
    }
  }
  const articleTitle = stripHtml(html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
  return {
    name,
    aliases: name && articleTitle.includes(name) ? [] : [],
    address,
    phone,
    episode,
    menus,
    articleTitle,
    resolvedUrl,
  };
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${String(value ?? "").replace(/"/g, '\\"')}"`);
  } catch {
    return String(value ?? "")
      .replace(/\\u([0-9a-f]{4})/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
      .replace(/\\\//g, "/");
  }
}

function jsonValue(html, keys) {
  for (const key of keys) {
    const match = html.match(new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"));
    if (match) return decodeJsonString(match[1]);
  }
  return "";
}

function parseNaverDetail(html, resolvedUrl) {
  const ogTitle = decodeHtml(
    html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ?? ""
  )
    .replace(/\s*[:|]\s*네이버.*$/i, "")
    .trim();
  const name = jsonValue(html, ["name", "businessName"]) || ogTitle;
  const address =
    jsonValue(html, ["roadAddress", "roadAddressName", "address", "addressName"]) || "";
  const phone = jsonValue(html, ["phone", "telephone", "virtualPhone"]) || "";
  return {
    name,
    aliases: [],
    address,
    phone,
    episode: null,
    menus: [],
    articleTitle: ogTitle,
    resolvedUrl,
  };
}

async function fetchEntryDetail(entry) {
  if (/nopo\.haedory\.com/i.test(entry.sourceUrl)) {
    const response = await fetchText(entry.sourceUrl);
    return parseDetail(entry, response.html, response.url);
  }

  if (/m\.site\.naver\.com/i.test(entry.sourceUrl)) {
    const shortResponse = await fetchText(entry.sourceUrl);
    const placeId = shortResponse.url.match(/(?:place\/|restaurant\/)(\d+)/i)?.[1];
    if (!placeId) return parseNaverDetail(shortResponse.html, shortResponse.url);
    const mobileResponse = await fetchText(
      `https://m.place.naver.com/restaurant/${placeId}/home`
    );
    return parseNaverDetail(mobileResponse.html, mobileResponse.url);
  }

  const placeId = entry.sourceUrl.match(/(?:place\/|restaurant\/)(\d+)/i)?.[1];
  if (placeId) {
    const response = await fetchText(`https://m.place.naver.com/restaurant/${placeId}/home`);
    return parseNaverDetail(response.html, response.url);
  }
  return null;
}

async function main() {
  const indexResponse = await fetchText(directoryUrl);
  const entries = parseIndex(indexResponse.html, indexResponse.url);
  console.log(`index entries ${entries.length}`);

  const detailResults = new Array(entries.length).fill(null);
  const detailIndexes = entries
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) =>
      /(?:nopo\.haedory\.com|map\.naver\.com|m\.site\.naver\.com)/i.test(entry.sourceUrl)
    );
  const concurrency = 8;
  for (let offset = 0; offset < detailIndexes.length; offset += concurrency) {
    const batch = detailIndexes.slice(offset, offset + concurrency);
    const responses = await Promise.all(
      batch.map(async ({ entry, index }) => {
        try {
          return { index, detail: await fetchEntryDetail(entry) };
        } catch (error) {
          return { index, detail: { error: error.message } };
        }
      })
    );
    responses.forEach(({ index, detail }) => {
      detailResults[index] = detail;
    });
    console.log(`details ${Math.min(offset + concurrency, detailIndexes.length)}/${detailIndexes.length}`);
  }

  const sourceId = "jeonhyunmoo-s2-secondary-directory";
  const restaurants = entries.map((entry, index) => {
    const detail = detailResults[index] ?? {};
    const exactName = detail.name ?? "";
    const representativeMenu = detail.menus?.[0]?.name ?? entry.directoryLabel;
    const confidence = exactName && detail.address ? 0.86 : exactName ? 0.75 : 0.6;
    return {
      id: `jhmp-s2-directory-${String(index + 1).padStart(3, "0")}`,
      season: 2,
      episode: detail.episode ?? null,
      restaurantRecordNo: null,
      name: exactName || entry.directoryLabel,
      aliases: exactName && exactName !== entry.directoryLabel ? [entry.directoryLabel] : [],
      region: inferRegion(entry.directoryLabel, detail.address ?? ""),
      address: detail.address ?? "",
      phone: detail.phone ?? "",
      category: inferCategory(entry.directoryLabel, representativeMenu),
      representativeMenu,
      menus: (detail.menus ?? []).map((menu) => ({
        ...menu,
        sourceId,
        observedAt: "2026-07-15",
        confidence,
      })),
      broadcastDate: null,
      sourceUrl: detail.resolvedUrl ?? entry.sourceUrl,
      secondaryDirectoryUrl: directoryUrl,
      evidenceText: entry.description,
      lat: null,
      lng: null,
      confidence,
      reviewStatus: "needs-review",
      notes:
        exactName && detail.address
          ? "보조 디렉터리 상세 문서에서 상호·주소를 확인함. MBN 공식 맛집기록은 미확인."
          : "보조 디렉터리의 주제명과 매장 링크만 확보됨. 상호·주소·회차 재검수 필요.",
    };
  });

  const exactNameCount = restaurants.filter((record) => !record.name.includes(" 맛집") && record.address).length;
  const addressCount = restaurants.filter((record) => record.address).length;
  const episodeCount = restaurants.filter((record) => Number.isFinite(record.episode)).length;
  const sources = [
    {
      id: "jeonhyunmoo-s2-official-program",
      type: "official-program",
      publisher: "MBN",
      url: officialProgramUrl,
      capturedAt: "2026-07-15",
    },
    {
      id: sourceId,
      type: "secondary-restaurant-directory",
      publisher: "인포투머니·노포수첩",
      url: directoryUrl,
      capturedAt: "2026-07-15",
    },
  ];
  const source = {
    id: "jeonhyunmoo-plan-season-2",
    name: "전현무계획 시즌 2",
    type: "tv_show",
    provider: "MBN",
    season: 2,
    episodeCount: 48,
    finalBroadcastDate: "2025-09-26",
    capturedAt: "2026-07-15",
    status: "secondary-directory-draft",
  };
  const report = `# 전현무계획 시즌 2 근거 보고서\n\n` +
    `- 방송: 48회, 최종회 2025-09-26\n` +
    `- 보조 디렉터리 식당 항목: ${restaurants.length}건\n` +
    `- 상호·주소 상세 근거: ${addressCount}건\n` +
    `- 회차 명시: ${episodeCount}건\n\n` +
    `MBN 과거 공개 게시판에서 시즌 2 개별 맛집기록을 확인하지 못해, '시즌2 맛집을 전부 모았다'고 명시한 보조 디렉터리를 초안 근거로 사용했다. 모든 항목은 \`needs-review\`이며, 주소가 빈 항목과 회차가 빈 항목은 맛픽 공개 전 재검수해야 한다.\n`;

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputRoot, "source.json"), `${JSON.stringify(source, null, 2)}\n`, "utf8"),
    writeFile(
      path.join(outputRoot, "restaurants.json"),
      `${JSON.stringify(restaurants, null, 2)}\n`,
      "utf8"
    ),
    writeFile(path.join(outputRoot, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputRoot, "evidence-report.md"), report, "utf8"),
  ]);
  console.log(
    JSON.stringify(
      { restaurantCount: restaurants.length, exactNameCount, addressCount, episodeCount },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
