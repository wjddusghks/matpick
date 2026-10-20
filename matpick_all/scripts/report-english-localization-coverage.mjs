import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  getEnglishAddress,
  getEnglishCreatorName,
  getEnglishMenuName,
  getEnglishProviderName,
  getEnglishRestaurantName,
  getEnglishSourceName,
  translateCuisineLabel,
} from "../client/src/lib/locale.ts";

const root = path.dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(fs.readFileSync(path.join(root, "../client/src/data/generated/public-dataset.json"), "utf8"));
const hasHangul = value => /[가-힣]/.test(String(value ?? ""));
const rows = [];

const check = (kind, id, korean, english) => {
  if (!String(korean ?? "").trim()) return;
  rows.push({ kind, id, korean, english, hangulRemaining: hasHangul(english) });
};

for (const restaurant of dataset.restaurants) {
  check("restaurant name", restaurant.id, restaurant.name, getEnglishRestaurantName(restaurant.name));
  check("address", restaurant.id, restaurant.address || restaurant.region, getEnglishAddress(restaurant.address || restaurant.region || ""));
  check("cuisine", restaurant.id, restaurant.category, translateCuisineLabel(restaurant.category || "", "en"));
  for (const [index, menu] of (restaurant.menus ?? []).entries()) {
    check("menu", `${restaurant.id}:${index}`, menu.name, getEnglishMenuName(menu.name));
  }
}
for (const source of dataset.sources ?? []) {
  check("source", source.id, source.name, getEnglishSourceName(source.name));
  check("provider", source.id, source.provider, getEnglishProviderName(source.provider || ""));
}
for (const creator of dataset.creators ?? []) {
  check("creator", creator.id, creator.name, getEnglishCreatorName(creator.name));
}

const byKind = Object.fromEntries(
  [...new Set(rows.map(row => row.kind))].sort().map(kind => {
    const matching = rows.filter(row => row.kind === kind);
    return [kind, {
      total: matching.length,
      sourceWithHangul: matching.filter(row => hasHangul(row.korean)).length,
      englishWithHangul: matching.filter(row => row.hangulRemaining).length,
    }];
  })
);
const failures = rows.filter(row => row.hangulRemaining);
const samples = rows.filter(row => hasHangul(row.korean)).slice(0, 20);
const report = { generatedFrom: "client/src/data/generated/public-dataset.json", totalFields: rows.length, failures, byKind, samples };
const reportDirectory = path.join(root, "../reports");
fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(path.join(reportDirectory, "english-localization-coverage.json"), `${JSON.stringify(report, null, 2)}\n`);
const table = Object.entries(byKind).map(([kind, value]) => `| ${kind} | ${value.total.toLocaleString("en-US")} | ${value.sourceWithHangul.toLocaleString("en-US")} | ${value.englishWithHangul} |`).join("\n");
const sampleTable = samples.map(row => `| ${row.kind} | ${String(row.korean).replaceAll("|", "\\|")} | ${String(row.english).replaceAll("|", "\\|")} |`).join("\n");
fs.writeFileSync(path.join(reportDirectory, "english-localization-coverage.md"), `# English localization coverage\n\nDeterministic audit of visitor-facing catalog fields. Korean source data is preserved; English is produced only at presentation time.\n\n| Field | Values | Korean source values | English values with Hangul |\n| --- | ---: | ---: | ---: |\n${table}\n\nEnglish values retaining Hangul: **${failures.length}**.\n\n## Deterministic samples\n\n| Field | Korean source | English display |\n| --- | --- | --- |\n${sampleTable}\n\n## Known limitation\n\nRestaurant and house-brand names without a verified official English spelling use deterministic Revised Romanization-style output. Menu phrases use reviewed exact translations and a culinary glossary; unfamiliar brand fragments remain romanized so the place or product stays identifiable.\n`);
console.log(JSON.stringify({ totalFields: rows.length, failures: failures.length, byKind }, null, 2));
if (failures.length) process.exitCode = 1;
