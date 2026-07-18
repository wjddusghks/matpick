import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

async function normalizeSeoulTaste100() {
  const filePath = path.join(root, "source-data", "seoul-taste-100", "restaurants.json");
  const records = JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  for (const record of records) {
    record.name = String(record.name ?? "").replace(/\s+05$/, "");
  }
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return records.length;
}

async function normalizeJeonSeason1() {
  const filePath = path.join(
    root,
    "source-data",
    "jeonhyunmoo-plan",
    "season-1",
    "restaurants.json"
  );
  const records = JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
  for (const record of records) {
    if (record.lat === undefined) record.lat = null;
    if (record.lng === undefined) record.lng = null;
  }
  await writeFile(filePath, `${JSON.stringify(records, null, 2)}\n`, "utf8");
  return records.length;
}

const [seoulCount, jeonCount] = await Promise.all([
  normalizeSeoulTaste100(),
  normalizeJeonSeason1(),
]);
console.log(`normalized Seoul Taste 100: ${seoulCount}`);
console.log(`normalized Jeon season 1: ${jeonCount}`);
