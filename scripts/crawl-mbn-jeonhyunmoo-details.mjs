import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceRoot = path.resolve(__dirname, "..", "source-data", "jeonhyunmoo-plan");
const indexPath = path.join(sourceRoot, "official-page-index.json");
const outputPath = path.join(sourceRoot, "official-detail-drafts.json");
const concurrency = 8;

function decodeHtml(value) {
  return String(value ?? "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)));
}

function htmlToLines(html) {
  const text = String(html ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<(?:br|\/p|\/div|\/li|\/td|\/h\d)\b[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtml(text)
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

async function fetchDetail(entry) {
  const response = await fetch(entry.url, {
    headers: { "User-Agent": "Mozilla/5.0 MatpickResearch/1.0" },
  });
  if (!response.ok) {
    throw new Error(`${entry.url}: ${response.status}`);
  }
  return { entry, lines: htmlToLines(await response.text()) };
}

function parseSeason(program) {
  const match = String(program).match(/(\d+)$/);
  return match ? Number(match[1]) : 1;
}

function parsePage({ entry, lines }) {
  const episode = Number(entry.title.match(/(\d+)회/)?.[1] ?? 0);
  const season = parseSeason(entry.program);
  const headings = [];
  const headingPattern = /\[전현무계획\d*\]\s*맛집 기록 No\.(\d+)\s*<([^>]+)>/;

  lines.forEach((line, index) => {
    const match = line.match(headingPattern);
    if (match) {
      headings.push({ index, restaurantRecordNo: Number(match[1]), name: match[2].trim() });
    }
  });

  return headings.map((heading, headingIndex) => {
    const nextIndex = headings[headingIndex + 1]?.index ?? lines.length;
    const block = lines.slice(heading.index + 1, nextIndex);
    const phoneIndex = block.findIndex((line) => /0\d{1,2}-\d{3,4}-\d{4}/.test(line));
    const phone = phoneIndex >= 0 ? block[phoneIndex].match(/0\d{1,2}-\d{3,4}-\d{4}/)?.[0] ?? "" : "";
    const address =
      phoneIndex > 0
        ? block
            .slice(Math.max(0, phoneIndex - 3), phoneIndex)
            .reverse()
            .find((line) =>
              /(?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\s/.test(
                line
              )
            ) ?? ""
        : "";
    const menus = [];
    const seenMenus = new Set();
    for (const line of block) {
      for (const match of line.matchAll(/\[([^\]]{1,40})\]/g)) {
        const name = match[1].replace(/\s+/g, " ").trim();
        if (name && !seenMenus.has(name)) {
          seenMenus.add(name);
          menus.push(name);
        }
      }
    }

    return {
      id: `jeonhyunmoo-plan-s${season}-no${heading.restaurantRecordNo}`,
      season,
      episode,
      restaurantRecordNo: heading.restaurantRecordNo,
      name: heading.name,
      address,
      phone,
      representativeMenu: menus[0] ?? "",
      menus,
      broadcastDate: entry.date,
      sourceUrl: entry.url,
      evidenceText: `MBN ${episode}회 공식 맛집기록에서 상호와 방송 정보를 확인함.`,
      confidence: address && phone && menus.length ? 1 : 0.8,
      reviewStatus: address && phone && menus.length ? "source-verified" : "needs-review",
      rawLines: block.slice(0, 120),
    };
  });
}

async function main() {
  const index = JSON.parse((await readFile(indexPath, "utf8")).replace(/^\uFEFF/, ""));
  const parsed = [];

  for (let offset = 0; offset < index.length; offset += concurrency) {
    const batch = index.slice(offset, offset + concurrency);
    const results = await Promise.all(
      batch.map(async (entry) => {
        try {
          return await fetchDetail(entry);
        } catch (error) {
          console.error(error.message);
          return null;
        }
      })
    );
    for (const result of results) {
      if (result) {
        parsed.push(...parsePage(result));
      }
    }
    console.log(`fetched ${Math.min(offset + concurrency, index.length)}/${index.length}`);
  }

  const deduped = Array.from(
    new Map(parsed.map((record) => [`${record.season}|${record.restaurantRecordNo}`, record])).values()
  ).sort(
    (a, b) =>
      a.season - b.season ||
      a.episode - b.episode ||
      a.restaurantRecordNo - b.restaurantRecordNo
  );

  await writeFile(outputPath, `${JSON.stringify(deduped, null, 2)}\n`, "utf8");
  console.log(`parsed ${deduped.length} restaurant records`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
