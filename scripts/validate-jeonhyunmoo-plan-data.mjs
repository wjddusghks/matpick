import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceRoot = path.resolve(__dirname, "..", "source-data", "jeonhyunmoo-plan");

const requiredTextFields = [
  "id",
  "name",
  "region",
  "category",
  "representativeMenu",
  "sourceUrl",
  "evidenceText",
  "reviewStatus",
];

async function readJson(filePath) {
  return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
}

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

function validateRecord(record, folderName, index, errors) {
  const label = `${folderName}[${index}]`;
  const isReviewDraft = /needs-review|draft/i.test(String(record.reviewStatus ?? ""));

  if (!Number.isInteger(record.season) || record.season < 1) {
    errors.push(`${label}: invalid season`);
  }
  if (
    !(Number.isInteger(record.episode) && record.episode >= 1) &&
    !(record.episode === null && isReviewDraft)
  ) {
    errors.push(`${label}: invalid episode`);
  }
  if (
    !(Number.isInteger(record.restaurantRecordNo) && record.restaurantRecordNo >= 1) &&
    record.restaurantRecordNo !== null
  ) {
    errors.push(`${label}: invalid restaurantRecordNo`);
  }

  for (const field of requiredTextFields) {
    if (!normalize(record[field])) {
      errors.push(`${label}: missing ${field}`);
    }
  }

  if (!Array.isArray(record.menus)) {
    errors.push(`${label}: menus must be an array`);
  }
  if (!(record.lat == null || Number.isFinite(record.lat))) {
    errors.push(`${label}: lat must be null or a number`);
  }
  if (!(record.lng == null || Number.isFinite(record.lng))) {
    errors.push(`${label}: lng must be null or a number`);
  }
  if (!isReviewDraft && !normalize(record.address)) {
    errors.push(`${label}: missing address`);
  }
  if (!isReviewDraft && !normalize(record.broadcastDate)) {
    errors.push(`${label}: missing broadcastDate`);
  }
  if (!Number.isFinite(record.confidence) || record.confidence < 0 || record.confidence > 1) {
    errors.push(`${label}: confidence must be between 0 and 1`);
  }
}

async function main() {
  const entries = await readdir(sourceRoot, { withFileTypes: true });
  const seasonFolders = entries
    .filter((entry) => entry.isDirectory() && /^season-\d+$/.test(entry.name))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const allRecords = [];
  const errors = [];
  const seenIds = new Set();
  const seenRecordNumbers = new Set();

  for (const folder of seasonFolders) {
    const filePath = path.join(sourceRoot, folder.name, "restaurants.json");
    let records;
    try {
      records = await readJson(filePath);
    } catch (error) {
      errors.push(`${folder.name}: unable to read restaurants.json (${error.message})`);
      continue;
    }

    if (!Array.isArray(records)) {
      errors.push(`${folder.name}: restaurants.json must contain an array`);
      continue;
    }

    records.forEach((record, index) => {
      validateRecord(record, folder.name, index, errors);
      if (seenIds.has(record.id)) {
        errors.push(`${folder.name}[${index}]: duplicate id ${record.id}`);
      }
      if (
        record.restaurantRecordNo != null &&
        seenRecordNumbers.has(record.restaurantRecordNo)
      ) {
        errors.push(
          `${folder.name}[${index}]: duplicate restaurantRecordNo ${record.restaurantRecordNo}`
        );
      }
      seenIds.add(record.id);
      if (record.restaurantRecordNo != null) {
        seenRecordNumbers.add(record.restaurantRecordNo);
      }
      allRecords.push(record);
    });

    console.log(`${folder.name}: ${records.length} records`);
  }

  const sortedNumbers = [...seenRecordNumbers].sort((a, b) => a - b);
  const gaps = [];
  for (let index = 1; index < sortedNumbers.length; index += 1) {
    const previous = sortedNumbers[index - 1];
    const current = sortedNumbers[index];
    for (let value = previous + 1; value < current; value += 1) {
      gaps.push(value);
    }
  }

  const uniqueRestaurants = new Set(
    allRecords.map((record) => `${normalize(record.name)}|${normalize(record.address)}`)
  );

  console.log(`total appearances: ${allRecords.length}`);
  console.log(`unique name/address pairs: ${uniqueRestaurants.size}`);
  console.log(`record number gaps: ${gaps.length ? gaps.join(", ") : "none"}`);

  if (errors.length) {
    console.error("\nValidation errors:");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exitCode = 1;
  } else {
    console.log("validation: ok");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
