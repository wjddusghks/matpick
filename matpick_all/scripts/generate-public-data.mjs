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
console.log(`Generated ${publicDataset.restaurants.length} public restaurants; ${Buffer.byteLength(output)} bytes (${gzipSync(output).length} gzip).`);
