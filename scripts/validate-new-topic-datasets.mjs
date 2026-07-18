import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const errors = [];

async function readJson(...parts) {
  return JSON.parse(
    (await readFile(path.join(root, ...parts), "utf8")).replace(/^\uFEFF/, "")
  );
}

function assert(condition, message) {
  if (!condition) errors.push(message);
}

function assertUniqueIds(records, label) {
  assert(
    new Set(records.map((record) => record.id)).size === records.length,
    `${label}: duplicate ids`
  );
}

const jeon = await readJson(
  "matpick_all",
  "client",
  "src",
  "data",
  "generated",
  "jeonhyunmoo-plan.generated.json"
);
assert(jeon.meta.appearanceCount === 270, "Jeon: expected 270 appearances");
assertUniqueIds(jeon.restaurants, "Jeon restaurants");
assert(
  jeon.sourceLinks.every((link) => jeon.restaurants.some((restaurant) => restaurant.id === link.restaurantId)),
  "Jeon: orphan source link"
);

const culinary = await readJson("source-data", "culinary-class-wars", "restaurants.json");
const culinarySeparated = await readJson(
  "source-data",
  "culinary-class-wars",
  "chefs-without-current-restaurant.json"
);
assert(culinary.length === 183, "Culinary Class Wars: expected 183 public affiliations");
assert(culinarySeparated.length === 12, "Culinary Class Wars: expected 12 separated records");
assert(
  culinary.filter((record) => record.season === 2 && record.spoonClass === "white").length === 29,
  "Culinary Class Wars: expected 29 season-2 white-spoon restaurants"
);
assert(
  culinary.filter((record) => record.season === 2 && record.spoonClass === "black").length === 34,
  "Culinary Class Wars: expected 34 season-2 black-spoon restaurants"
);
assertUniqueIds(culinary, "Culinary Class Wars restaurants");

const seoul = await readJson("source-data", "seoul-taste-100", "restaurants.json");
assert(seoul.length === 100, "Seoul Taste 100: expected 100 restaurants");
assertUniqueIds(seoul, "Seoul Taste 100 restaurants");
assert(
  seoul.every((record) => record.name && record.address && record.category && record.phone),
  "Seoul Taste 100: missing required official field"
);
const categoryCounts = seoul.reduce((result, record) => {
  result[record.category] = (result[record.category] ?? 0) + 1;
  return result;
}, {});
const expectedCounts = {
  "한식": 28,
  "양식": 21,
  "아시아": 14,
  "그릴": 11,
  "채식": 9,
  "디저트&카페": 10,
  "바&펍": 7,
};
for (const [category, count] of Object.entries(expectedCounts)) {
  assert(categoryCounts[category] === count, `Seoul Taste 100: ${category} expected ${count}`);
}

if (errors.length) {
  console.error("Validation errors:");
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log("new topic dataset validation: ok");
  console.log("Jeon Hyun-moo Plan: 270 appearances");
  console.log("Culinary Class Wars: 183 public + 12 separated affiliations");
  console.log("Seoul Taste 100: 100 official restaurants");
}
