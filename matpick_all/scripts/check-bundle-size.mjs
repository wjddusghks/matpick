import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gzipSync } from "node:zlib";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(path.join(root, "dist/.vite/manifest.json"), "utf8"));
const entry = Object.keys(manifest).find(key => manifest[key].isEntry);
assert.ok(entry, "Missing application entry in Vite manifest");
const home = Object.keys(manifest).find(key => key.endsWith("/Home.tsx"));
const map = Object.keys(manifest).find(key => key.endsWith("/SearchMap.tsx"));
// Vite names the data utilities shared by catalog-backed routes as an internal chunk.
const catalog = (manifest[map]?.imports ?? []).find(key =>
  manifest[key]?.name === "index" && !manifest[key]?.isEntry);
assert.ok(home && map && catalog, "Expected routes and lazy catalog in manifest");

async function measure(roots) {
  const seen = new Set();
  function visit(key) {
    if (seen.has(key)) return;
    assert.ok(manifest[key], `Unknown chunk: ${key}`);
    seen.add(key);
    for (const dependency of manifest[key].imports ?? []) visit(dependency);
  }
  roots.forEach(visit);
  let bytes = 0, gzipBytes = 0;
  for (const key of seen) {
    const contents = await readFile(path.join(root, "dist", manifest[key].file));
    bytes += contents.length;
    gzipBytes += gzipSync(contents).length;
  }
  return { bytes, gzipBytes, chunks: [...seen] };
}
const report = {
  basis: "Sum of built JavaScript chunks and their gzip sizes, following static imports only; excludes CSS/images/third-party requests and is not a page-load-time measurement.",
  entry: await measure([entry]),
  home: await measure([entry, home]),
  map: await measure([entry, map]),
  catalog: await measure([catalog]),
};
assert.ok(!report.home.chunks.includes(catalog), "Home eagerly downloads the restaurant catalog");
assert.ok(report.entry.gzipBytes < 200_000, "Entry JavaScript exceeds the 200 KB gzip budget");
assert.ok(report.home.gzipBytes < 300_000, "Home JavaScript exceeds the 300 KB gzip budget");
assert.ok(report.map.gzipBytes < 350_000, "Map JavaScript exceeds the 350 KB gzip budget");

// A few catalog rows in a UI chunk can be legitimate, but IDs sampled across the
// source dataset appearing together indicate the generated bulk payload leaked.
const publicDataset = JSON.parse(await readFile(
  path.join(root, "client/src/data/generated/public-dataset.json"),
  "utf8"
));
const sentinels = [0.2, 0.5, 0.8].map(position =>
  publicDataset.restaurants[Math.floor(publicDataset.restaurants.length * position)]?.id
).filter(Boolean);
const javascript = (await Promise.all(
  Object.values(manifest)
    .map(entry => entry.file)
    .filter(file => file.endsWith(".js"))
    .map(file => readFile(path.join(root, "dist", file), "utf8"))
)).join("\n");
assert.ok(
  !sentinels.every(id => javascript.includes(id)),
  "The generated restaurant dataset was emitted into public JavaScript"
);
await mkdir(path.join(root, "reports"), { recursive: true });
await writeFile(path.join(root, "reports/bundle-size.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`JavaScript gzip: entry ${report.entry.gzipBytes} B, home ${report.home.gzipBytes} B, map ${report.map.gzipBytes} B. Bulk catalog payload absent from public JavaScript.`);
