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
  "season-1",
  "secondary-directory-draft.json"
);
const indexUrl =
  "https://shop.haedory.com/%EC%A0%84%ED%98%84%EB%AC%B4%EA%B3%84%ED%9A%8D-%EB%A7%9B%EC%A7%91/";

function decodeHtml(value) {
  const entities = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (all, name) => entities[name.toLowerCase()] ?? all);
}

function clean(value) {
  return decodeHtml(
    String(value ?? "")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<br\s*\/?\s*>/gi, "\n")
      .replace(/<\/(?:p|div|li|td|h\d)\s*>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[\t ]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 MatpickResearch/1.0" },
    redirect: "follow",
  });
  if (!response.ok) throw new Error(`${response.status}: ${url}`);
  return { url: response.url, html: await response.text() };
}

function getHeadingBlocks(html) {
  const headings = [...html.matchAll(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi)];
  return headings.map((heading, index) => {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? html.length;
    return { title: clean(heading[1]), body: html.slice(start, end) };
  });
}

function relevantLinks(html, baseUrl) {
  const links = [];
  for (const match of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) {
    let href;
    try {
      href = new URL(decodeHtml(match[1]), baseUrl).href;
    } catch {
      continue;
    }
    if (
      /(?:haedory\.com|money-dory\.tistory\.com|nopo\.haedory\.com)/i.test(href) &&
      href !== indexUrl
    ) {
      links.push(href);
    }
  }
  return [...new Set(links)];
}

function extractDetail(html) {
  const text = clean(html);
  const title = clean(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const ogTitle = decodeHtml(
    html.match(/<meta\b[^>]*property=["']og:title["'][^>]*content=["']([^"']+)/i)?.[1] ?? ""
  );
  const episodeMatches = [...text.matchAll(/전현무계획\s*(\d+)\s*(?:화|회)/g)].map((m) => Number(m[1]));
  const addressMatches = [
    ...text.matchAll(
      /(?:주소|위치)\s*[:：]?\s*((?:서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)[^\n]{4,100})/g
    ),
  ].map((m) => m[1].replace(/\s+/g, " ").trim());
  const phone = text.match(/(?:0\d{1,2}-\d{3,4}-\d{4}|1\d{3}-\d{4})/)?.[0] ?? "";
  return {
    title: ogTitle || title,
    episodes: [...new Set(episodeMatches)].filter((n) => n >= 1 && n <= 18),
    addresses: [...new Set(addressMatches)],
    phone,
    excerpt: text.slice(0, 1200),
  };
}

async function main() {
  const index = await fetchText(indexUrl);
  const blocks = getHeadingBlocks(index.html).filter(
    (block) => block.title && !/Leave a Comment|관련/.test(block.title)
  );
  const drafts = [];

  for (const block of blocks) {
    const links = relevantLinks(block.body, index.url).slice(0, 3);
    const details = [];
    for (const link of links) {
      try {
        const result = await fetchText(link);
        details.push({ sourceUrl: result.url, ...extractDetail(result.html) });
      } catch (error) {
        details.push({ sourceUrl: link, error: error.message });
      }
    }
    drafts.push({ directoryLabel: block.title, directoryUrl: index.url, details });
    console.log(`${drafts.length}/${blocks.length} ${block.title}: ${details.length}`);
  }

  await writeFile(outputPath, `${JSON.stringify(drafts, null, 2)}\n`, "utf8");
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
