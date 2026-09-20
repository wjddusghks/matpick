// Small first batch of factual listings. No photos, review prose or full articles are retained.
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(root, "source-data/topic-expansion-2026-09");
const checkedAt = new Date().toISOString().slice(0, 10);
const clean = (s) =>
  s
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
let last = 0;
async function get(url) {
  await new Promise((r) =>
    setTimeout(r, Math.max(0, 1000 - (Date.now() - last))),
  );
  last = Date.now();
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`Stopped ${r.status}: ${new URL(url).hostname}`);
  return r.text();
}
const rows = [];
const seoul = "https://tasteofseoul.visitseoul.net";
const list = await get(`${seoul}/restaurants/list`);
const links = [
  ...new Set(
    [...list.matchAll(/href="([^"#]*wm_id=[^"]*)"/g)].map((m) => m[1]),
  ),
].slice(0, 12);
for (const link of links) {
  const url = new URL(link, seoul).href,
    t = await get(url);
  const name = clean(t.match(/<h4>([\s\S]*?)<\/h4>/)?.[1] || "");
  const address = clean(
    t.match(/<strong>주소<\/strong>\s*<p>([\s\S]*?)<\/p>/)?.[1] || "",
  );
  const year = t.match(/Taste of <b>Seoul<\/b> (20\d{2})/)?.[1];
  if (!name || !address || !year) throw new Error("Seoul parser needs review");
  rows.push({
    id: `topic_seoul_${new URL(url).searchParams.get("wm_id")}`,
    topicId: "taste-of-seoul",
    priority: 8,
    name,
    address,
    evidence: [
      {
        url,
        publishedAt: year,
        label: `${year} 서울미식 100선`,
        basis: "official_guide",
        sourceObservedAt: checkedAt,
      },
    ],
    sourceCheckedAt: checkedAt,
  });
}
for (const city of ["26", "50"])
  for (const page of [1, 2]) {
    const url =
      "https://www.goodprice.go.kr/bssh/bsshList.do?" +
      new URLSearchParams({
        srchCtpvCd: city,
        srchIndutyCdArr: "10,18,19,20,29,21",
        pageIndex: String(page),
      });
    const t = await get(url);
    for (const s of t
      .split("<li>")
      .filter((s) => s.includes('class="msl_nm_wrap"'))) {
      const name = clean(s.match(/class="mr10">([^<]+)/)?.[1] || ""),
        id = s.match(/goInfo\('([0-9]+)'/)?.[1];
      const values = [...s.matchAll(/<div class="td">([^<]+)<\/div>/g)].map(
        (m) => clean(m[1]),
      );
      if (!name || !id || values.length < 4)
        throw new Error("Goodprice parser needs review");
      rows.push({
        id: `topic_goodprice_${id}`,
        topicId: "good-price",
        priority: 10,
        name,
        address: values[0],
        representativeMenu: values[2],
        officialMenus: [{ name: values[2], price: values[3] }],
        evidence: [
          {
            url: `https://www.goodprice.go.kr/bssh/bsshInfo.do?bsshSn=${id}`,
            listUrl: url,
            label: "착한가격업소 · 요식업",
            basis: "official_designation",
            sourceObservedAt: checkedAt,
          },
        ],
        sourceCheckedAt: checkedAt,
      });
    }
  }
await fs.writeFile(
  path.join(dir, "guide-candidates.json"),
  JSON.stringify(rows, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    candidates: rows.length,
    topics: rows.reduce(
      (a, r) => ((a[r.topicId] = (a[r.topicId] || 0) + 1), a),
      {},
    ),
  }),
);
