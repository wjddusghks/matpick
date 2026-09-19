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
// Vite names a module shared by lazy and static routes as an internal chunk.
const catalog = (manifest[home]?.dynamicImports ?? []).find(key =>
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
assert.ok(report.map.gzipBytes < 1_100_000, "Map JavaScript exceeds the 1.1 MB gzip budget");
await mkdir(path.join(root, "reports"), { recursive: true });
await writeFile(path.join(root, "reports/bundle-size.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`JavaScript gzip: entry ${report.entry.gzipBytes} B, home ${report.home.gzipBytes} B, map ${report.map.gzipBytes} B. Home catalog loading is deferred.`);
