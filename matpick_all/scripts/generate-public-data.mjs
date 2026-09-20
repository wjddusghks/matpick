import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { loadAppModules, projectRoot } from "./load-public-data.mjs";

// Merge raw research sources at build time. Browsers load only the public result.
const [{ publicDataset }] = await loadAppModules(["/src/data/buildPublicDataset.ts"]);
const output = JSON.stringify(publicDataset) + "\n";
const filename = path.join(projectRoot, "client/src/data/generated/public-dataset.json");
const previous = await readFile(filename, "utf8").catch(() => "");
if (previous !== output) await writeFile(filename, output);
// Count canonical IDs after all merges and publication filters, not raw feed rows.
const highlights = ["busan-bite", "jeju-bite", "jeonhyunmoo-plan"].map(slug => ({
  slug,
  count: new Set(publicDataset.sourceLinks.filter(link => link.sourceId === slug).map(link => link.restaurantId)).size,
})).filter(topic => topic.count > 0);
await writeFile(path.join(projectRoot, "client/src/data/generated/discovery-highlights.generated.json"), JSON.stringify(highlights, null, 2) + "\n");
console.log(`Generated ${publicDataset.restaurants.length} public restaurants; ${Buffer.byteLength(output)} bytes (${gzipSync(output).length} gzip).`);
