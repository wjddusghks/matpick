import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "source-data/discovery-release-2026-09");
await fs.mkdir(dir, { recursive: true });
const old = JSON.parse(
  await fs.readFile(
    path.join(
      root,
      "matpick_all/client/src/data/generated/jeonhyunmoo-plan.generated.json",
    ),
    "utf8",
  ),
);
const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
const strip = (s) =>
  decode(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const delay = () => new Promise((r) => setTimeout(r, 1000));
async function page(url) {
  await delay();
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`MBN returned ${r.status}`);
  return r.text();
}
const index = [];
for (let i = 1; i <= 16; i++) {
  const h = await page(`https://www.mbn.co.kr/totalCast/${i}`);
  for (const m of h.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...m[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((x) =>
      strip(x[1]),
    );
    if (!/^전현무계획\d*$/.test(cells[0] || "")) continue;
    const href = m[1].match(/\/totalCastView\/(\d+)\/(\d+)/);
    if (href)
      index.push({
        season: Number(cells[0].match(/\d+$/)?.[0] || 1),
        episode: Number(cells[1].match(/(\d+)회/)?.[1]),
        date: cells[2].replace(/\.\s*/g, "-").replace(/-$/, ""),
        url: `https://www.mbn.co.kr${href[0]}`,
      });
  }
  if (index.some((x) => x.season === 3)) break;
}
for (const r of old.occurrences) {
  if (!r.sourceUrl?.includes("www.mbn.co.kr/totalCastView/")) continue;
  if (!index.some((x) => x.url.split("/")[4] === r.sourceUrl.split("/")[4]))
    index.push({
      season: r.season,
      episode: r.episode,
      date: r.broadcastDate,
      url: r.sourceUrl,
    });
}
const records = [];
for (const e of index) {
  const h = await page(e.url);
  const lines = decode(
    h
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<(?:br|\/p|\/div|\/li|\/td|\/h\d)\b[^>]*>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split(/\r?\n/)
    .map((x) => x.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const headings = lines.flatMap((x, i) => {
    const m = x.match(/\[전현무계획\d*\]\s*맛집 기록 No\.(\d+)\s*<([^>]+)>/);
    return m ? [{ i, no: Number(m[1]), name: m[2] }] : [];
  });
  for (let i = 0; i < headings.length; i++) {
    const a = headings[i],
      block = lines.slice(a.i + 1, headings[i + 1]?.i ?? lines.length);
    const address =
      block.find(
        (x) =>
          /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)\S*\s/.test(
            x,
          ) && /(?:로|길|동|리)\s*\d/.test(x),
      ) || "";
    const phone =
      block.join(" ").match(/(?:0\d{1,3})-\d{3,4}-\d{4}/)?.[0] || "";
    const menus = [
      ...new Set(
        block.flatMap((x) =>
          [...x.matchAll(/\[([^\]]{1,35})\]/g)].map((m) => m[1]),
        ),
      ),
    ].filter((x) => !x.startsWith("전현무"));
    records.push({
      id: `jeonhyunmoo-plan-s${e.season}-no${a.no}`,
      season: e.season,
      episode: e.episode,
      restaurantRecordNo: a.no,
      name: a.name,
      address: address.replace(/\s*0\d{1,3}-\d{3,4}-\d{4}.*/, ""),
      phone,
      representativeMenu: menus.slice(0, 3).join(" / "),
      menus: menus.map((name) => ({ name })),
      broadcastDate: e.date,
      sourceUrl: e.url,
      sourceCheckedAt: new Date().toISOString().slice(0, 10),
    });
  }
  console.log(
    `Official facts: season ${e.season} episode ${e.episode}, ${headings.length} restaurants`,
  );
}
await fs.writeFile(
  path.join(dir, "broadcast-official.json"),
  JSON.stringify(
    { checkedAt: new Date().toISOString(), index, records },
    null,
    2,
  ) + "\n",
);
console.log(
  JSON.stringify({
    pages: index.length,
    restaurants: records.length,
    latest: index[0],
  }),
);
