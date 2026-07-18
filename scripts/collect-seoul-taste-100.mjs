import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const outputRoot = path.join(root, "source-data", "seoul-taste-100");
const siteRoot = "https://tasteofseoul.visitseoul.net";
const listRoot = `${siteRoot}/_subpage/kor/restaurants/list.php`;
const announcementUrl =
  "https://culture.seoul.go.kr/culture/bbs/B0000001/view.do?menuNo=200050&nttId=15244&pageIndex=8";

const categories = ["디저트&카페", "바&펍", "한식", "양식", "아시아", "그릴", "채식"];
const expectedCategoryCounts = {
  "한식": 28,
  "양식": 21,
  "아시아": 14,
  "그릴": 11,
  "채식": 9,
  "디저트&카페": 10,
  "바&펍": 7,
};

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
      .replace(/<\/(?:p|div|li|dd|dt|h\d|span)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 MatpickResearch/1.0" },
  });
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  return { url: response.url, html: await response.text() };
}

function parseListPage(html, baseUrl) {
  const result = [];
  for (const match of html.matchAll(
    /<a\b[^>]*href=["']([^"']*(?:restaurants\/view|restaurants\/view\.php)[^"']*wm_id=\d+[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi
  )) {
    const url = new URL(decodeHtml(match[1]), baseUrl).href;
    const text = stripHtml(match[2]);
    const wmId = Number(new URL(url).searchParams.get("wm_id"));
    const phone = text.match(/(?:0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})/)?.[0] ?? "";
    const category = categories.find((candidate) => text.startsWith(candidate)) ?? "";
    const name = text
      .replace(new RegExp(`^${category.replace(/[&]/g, "\\&")}\\s*`), "")
      .replace(phone, "")
      .replace(/\s+05$/, "")
      .replace(/\s+/g, " ")
      .trim();
    if (wmId && name && category) result.push({ wmId, name, category, phone, url });
  }
  return result;
}

function valueAfterLabel(lines, label) {
  const index = lines.findIndex((line) => line === label || line.startsWith(`${label} `));
  if (index < 0) return "";
  const inline = lines[index].slice(label.length).trim();
  if (inline) return inline;
  return lines[index + 1] ?? "";
}

function parseDetail(listing, html) {
  const lines = htmlLines(html);
  const address =
    valueAfterLabel(lines, "주소") ||
    lines.find((line) => /^서울\s+\S+구\s+/.test(line)) ||
    "";
  const phone = valueAfterLabel(lines, "전화번호") || listing.phone;
  const hours = valueAfterLabel(lines, "이용시간");
  const closingDays = valueAfterLabel(lines, "휴무일");
  const nameIndex = lines.findIndex((line) => line === listing.name);
  const description =
    nameIndex >= 0
      ? lines
          .slice(nameIndex + 1)
          .find(
            (line) =>
              line.length >= 30 &&
              !/[₩￦]\s*[\d,]+/.test(line) &&
              !/^(?:이용시간|주소|전화번호|휴무일)$/.test(line)
          ) ?? ""
      : "";
  const menus = [];
  const seen = new Set();
  for (const line of lines) {
    const priceMatch = line.match(/(.{1,80}?)\s+[₩￦]\s*([\d,]+)/);
    if (!priceMatch) continue;
    const menuName = priceMatch[1].trim();
    const price = `₩${priceMatch[2]}`;
    const key = `${menuName}|${price}`;
    if (!seen.has(key)) {
      seen.add(key);
      menus.push({ name: menuName, price, isSignature: menus.length === 0 });
    }
  }
  const imageUrl =
    decodeHtml(
      html.match(/<meta\b[^>]*(?:property|name)=["']og:image["'][^>]*content=["']([^"']+)/i)?.[1] ??
        ""
    ) || "";
  return {
    id: `seoul-taste-100-2025-${listing.wmId}`,
    year: 2025,
    ordinal: null,
    name: listing.name,
    aliases: [],
    region: address.match(/^서울\s+(\S+구)/)?.[1] ?? "",
    address,
    category: listing.category,
    representativeMenu: menus[0]?.name ?? "",
    menus,
    phone,
    hours,
    closingDays,
    description,
    lat: null,
    lng: null,
    imageCandidates: imageUrl
      ? [
          {
            url: imageUrl,
            sourceUrl: listing.url,
            platform: "Taste of Seoul",
            author: "서울특별시",
            usageStatus: "needs-review",
            caption: `${listing.name} 공식 안내 이미지`,
            capturedAt: "2026-07-15",
          },
        ]
      : [],
    sourceUrl: listing.url,
    evidence: [
      {
        sourceId: "seoul-taste-100-official-site",
        sourceUrl: listing.url,
        capturedAt: "2026-07-15",
        rawText: `${listing.category} | ${listing.name} | ${address} | ${phone}`,
        confidence: address ? 1 : 0.8,
      },
    ],
    confidence: address ? 1 : 0.8,
    reviewStatus: address ? "source-verified" : "needs-review",
  };
}

function countBy(records, field) {
  return records.reduce((result, record) => {
    result[record[field]] = (result[record[field]] ?? 0) + 1;
    return result;
  }, {});
}

async function main() {
  const listResponses = await Promise.all(
    Array.from({ length: 9 }, (_, index) =>
      fetchText(`${listRoot}?page=${index + 1}&txt_search=`)
    )
  );
  const listings = Array.from(
    new Map(
      listResponses
        .flatMap((response) => parseListPage(response.html, response.url))
        .map((entry) => [entry.wmId, entry])
    ).values()
  );
  if (listings.length !== 100) {
    throw new Error(`Expected 100 official listings, parsed ${listings.length}`);
  }

  const restaurants = [];
  const concurrency = 10;
  for (let offset = 0; offset < listings.length; offset += concurrency) {
    const batch = listings.slice(offset, offset + concurrency);
    const responses = await Promise.all(batch.map((listing) => fetchText(listing.url)));
    responses.forEach((response, index) => {
      restaurants.push(parseDetail(batch[index], response.html));
    });
    console.log(`details ${Math.min(offset + concurrency, listings.length)}/${listings.length}`);
  }
  restaurants
    .sort((a, b) => a.name.localeCompare(b.name, "ko"))
    .forEach((restaurant, index) => {
      restaurant.ordinal = index + 1;
    });

  const actualCategoryCounts = countBy(restaurants, "category");
  if (JSON.stringify(actualCategoryCounts) !== JSON.stringify(expectedCategoryCounts)) {
    for (const [category, expected] of Object.entries(expectedCategoryCounts)) {
      if (actualCategoryCounts[category] !== expected) {
        throw new Error(
          `Category ${category}: expected ${expected}, got ${actualCategoryCounts[category] ?? 0}`
        );
      }
    }
  }

  const sources = [
    {
      id: "seoul-taste-100-announcement",
      type: "official-announcement",
      publisher: "서울특별시",
      url: announcementUrl,
      capturedAt: "2026-07-15",
    },
    {
      id: "seoul-taste-100-official-site",
      type: "official-directory",
      publisher: "Taste of Seoul",
      url: `${siteRoot}/restaurants/list`,
      capturedAt: "2026-07-15",
    },
  ];
  const source = {
    id: "seoul-taste-100-2025",
    name: "2025 서울미식 100선",
    type: "guide",
    provider: "서울특별시",
    year: 2025,
    capturedAt: "2026-07-15",
    status: "completed",
    sourceUrl: `${siteRoot}/restaurants/list`,
  };
  const meta = {
    generatedAt: new Date().toISOString(),
    restaurantCount: restaurants.length,
    categoryCounts: actualCategoryCounts,
    verifiedAddressCount: restaurants.filter((restaurant) => restaurant.address).length,
    menuEvidenceCount: restaurants.filter((restaurant) => restaurant.menus.length).length,
  };
  const report = `# 2025 서울미식 100선 근거 보고서\n\n` +
    `- 수집일: 2026-07-15\n` +
    `- 공식 목록: ${meta.restaurantCount}곳\n` +
    `- 주소 확보: ${meta.verifiedAddressCount}곳\n` +
    `- 메뉴·가격 근거: ${meta.menuEvidenceCount}곳\n` +
    `- 분야별: ${Object.entries(meta.categoryCounts)
      .map(([category, count]) => `${category} ${count}`)
      .join(", ")}\n\n` +
    `모든 상호·분야·주소·전화·메뉴는 2025 서울미식주간 공식 디렉터리에서 수집했다. 가격과 운영시간은 변경될 수 있으므로 게시 직전 재확인한다. 이미지는 이용권 검토 전에 게시하지 않는다.\n`;

  await mkdir(outputRoot, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputRoot, "source.json"), `${JSON.stringify(source, null, 2)}\n`, "utf8"),
    writeFile(
      path.join(outputRoot, "restaurants.json"),
      `${JSON.stringify(restaurants, null, 2)}\n`,
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
