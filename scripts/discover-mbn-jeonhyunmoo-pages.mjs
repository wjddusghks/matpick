import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outputPath = path.resolve(
  __dirname,
  "..",
  "source-data",
  "jeonhyunmoo-plan",
  "official-page-index.json"
);
const startPage = Number(process.argv[2] ?? 1);
const endPage = Number(process.argv[3] ?? 130);
const concurrency = 10;

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

function stripHtml(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchPage(page) {
  const url = `https://www.mbn.co.kr/pages/customer/totalCast.php?page=${page}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 MatpickResearch/1.0" },
  });
  if (!response.ok) {
    throw new Error(`${url}: ${response.status}`);
  }
  return { page, url, html: await response.text() };
}

function extractRows(page, html) {
  const results = [];
  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  for (const match of html.matchAll(rowPattern)) {
    const rowHtml = match[1];
    const text = stripHtml(rowHtml);
    if (!text.includes("전현무계획")) {
      continue;
    }

    const urlMatch = rowHtml.match(
      /(?:https?:)?\/\/www\.mbn\.co\.kr\/totalCastView\/(\d+)\/(\d+)/i
    );
    if (!urlMatch) {
      continue;
    }

    const cells = [...rowHtml.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) =>
      stripHtml(cell[1])
    );
    const program = cells.find((cell) => /^전현무계획\d*$/.test(cell)) ?? cells[0] ?? "";
    const title = cells.find((cell) => cell.includes("맛집기록")) ?? cells[1] ?? "";
    const date = cells.find((cell) => /^20\d{2}\.\s*\d{2}\.\s*\d{2}$/.test(cell)) ?? "";

    results.push({
      page,
      program,
      title,
      date: date.replace(/\.\s*/g, "-").replace(/-$/, ""),
      url: `https://www.mbn.co.kr/totalCastView/${urlMatch[1]}/${urlMatch[2]}`,
      castId: Number(urlMatch[1]),
    });
  }
  return results;
}

async function main() {
  const pages = Array.from(
    { length: Math.max(0, endPage - startPage + 1) },
    (_, index) => startPage + index
  );
  const results = [];

  for (let offset = 0; offset < pages.length; offset += concurrency) {
    const batch = pages.slice(offset, offset + concurrency);
    const responses = await Promise.all(
      batch.map(async (page) => {
        try {
          return await fetchPage(page);
        } catch (error) {
          console.error(error.message);
          return null;
        }
      })
    );

    for (const response of responses) {
      if (response) {
        results.push(...extractRows(response.page, response.html));
      }
    }
    console.log(`scanned ${Math.min(offset + concurrency, pages.length)}/${pages.length}`);
  }

  const deduped = Array.from(new Map(results.map((entry) => [entry.url, entry])).values()).sort(
    (a, b) => a.date.localeCompare(b.date) || a.castId - b.castId
  );

  await writeFile(outputPath, `${JSON.stringify(deduped, null, 2)}\n`, "utf8");
  console.log(`found ${deduped.length} official pages`);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
