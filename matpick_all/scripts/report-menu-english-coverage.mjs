import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { translateMenuNameDetailed } from "../client/src/lib/menuEnglish.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const inputPath = path.join(root, "client/src/data/generated/public-dataset.json");
const reportDirectory = path.join(root, "reports");
const jsonPath = path.join(reportDirectory, "menu-english-coverage.json");
const markdownPath = path.join(reportDirectory, "menu-english-coverage.md");

const dataset = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const names = dataset.restaurants.flatMap(restaurant =>
  (restaurant.menus ?? []).map(menu => String(menu.name ?? "").trim()).filter(Boolean)
);
const frequency = new Map();
for (const name of names) frequency.set(name, (frequency.get(name) ?? 0) + 1);

const unique = [...frequency].map(([name, rows]) => ({
  name,
  rows,
  ...translateMenuNameDetailed(name),
}));

function classify(item) {
  if (item.totalHangulCharacters === 0) return "nonKorean";
  if (item.translatedHangulCharacters === item.totalHangulCharacters) return "fullSemantic";
  if (item.translatedHangulCharacters > 0) return "partialSemantic";
  return "romanizedOnly";
}

function summarize(items, weight = () => 1) {
  const summary = {
    total: 0,
    exact: 0,
    fullSemantic: 0,
    partialSemantic: 0,
    romanizedOnly: 0,
    nonKorean: 0,
    withSemanticTranslation: 0,
    hangulCharacters: 0,
    semanticallyTranslatedHangulCharacters: 0,
  };
  for (const item of items) {
    const multiplier = weight(item);
    summary.total += multiplier;
    summary[classify(item)] += multiplier;
    if (item.exact) summary.exact += multiplier;
    if (item.translatedHangulCharacters > 0) summary.withSemanticTranslation += multiplier;
    summary.hangulCharacters += item.totalHangulCharacters * multiplier;
    summary.semanticallyTranslatedHangulCharacters += item.translatedHangulCharacters * multiplier;
  }
  summary.semanticRowPercent = Number((summary.withSemanticTranslation / Math.max(1, summary.total - summary.nonKorean) * 100).toFixed(2));
  summary.fullSemanticPercent = Number((summary.fullSemantic / Math.max(1, summary.total - summary.nonKorean) * 100).toFixed(2));
  summary.semanticCharacterPercent = Number((summary.semanticallyTranslatedHangulCharacters / Math.max(1, summary.hangulCharacters) * 100).toFixed(2));
  return summary;
}

const unresolvedSegmentCounts = new Map();
for (const item of unique) {
  for (const segment of new Set(item.unknownSegments)) {
    unresolvedSegmentCounts.set(segment, (unresolvedSegmentCounts.get(segment) ?? 0) + item.rows);
  }
}

const unresolvedNames = unique
  .filter(item => item.totalHangulCharacters > item.translatedHangulCharacters)
  .sort((left, right) => right.rows - left.rows ||
    (right.totalHangulCharacters - right.translatedHangulCharacters) - (left.totalHangulCharacters - left.translatedHangulCharacters) ||
    left.name.localeCompare(right.name, "ko"))
  .slice(0, 300)
  .map(item => ({
    korean: item.name,
    english: item.english,
    rows: item.rows,
    translatedHangulCharacters: item.translatedHangulCharacters,
    totalHangulCharacters: item.totalHangulCharacters,
    unknownSegments: item.unknownSegments,
  }));

const report = {
  source: path.relative(root, inputPath).replaceAll("\\", "/"),
  definitions: {
    exact: "The normalized complete menu name has a reviewed English entry.",
    fullSemantic: "Every Hangul character was handled by an exact phrase, culinary term, or factual menu-metadata rule.",
    partialSemantic: "At least one culinary term was translated; remaining Hangul was romanized and is listed for review.",
    romanizedOnly: "No semantic term matched. The Hangul was romanized for display and remains unresolved.",
  },
  rowCoverage: summarize(unique, item => item.rows),
  uniqueNameCoverage: summarize(unique),
  topUnresolvedSegments: [...unresolvedSegmentCounts]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0], "ko"))
    .slice(0, 300)
    .map(([segment, rows]) => ({ segment, rows })),
  topUnresolvedNames: unresolvedNames,
};

fs.mkdirSync(reportDirectory, { recursive: true });
fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

const row = report.rowCoverage;
const distinct = report.uniqueNameCoverage;
const markdown = `# Menu English coverage\n\n` +
  `Generated from \`${report.source}\`. The report counts actual menu rows only; representative-menu summaries are excluded to avoid double-counting.\n\n` +
  `| Measure | Menu rows | Distinct names |\n| --- | ---: | ---: |\n` +
  `| Total | ${row.total.toLocaleString("en-US")} | ${distinct.total.toLocaleString("en-US")} |\n` +
  `| Reviewed exact phrase | ${row.exact.toLocaleString("en-US")} | ${distinct.exact.toLocaleString("en-US")} |\n` +
  `| Fully semantic | ${row.fullSemantic.toLocaleString("en-US")} (${row.fullSemanticPercent}%) | ${distinct.fullSemantic.toLocaleString("en-US")} (${distinct.fullSemanticPercent}%) |\n` +
  `| Partial semantic + romanized remainder | ${row.partialSemantic.toLocaleString("en-US")} | ${distinct.partialSemantic.toLocaleString("en-US")} |\n` +
  `| Romanized only / unresolved | ${row.romanizedOnly.toLocaleString("en-US")} | ${distinct.romanizedOnly.toLocaleString("en-US")} |\n` +
  `| Already non-Korean | ${row.nonKorean.toLocaleString("en-US")} | ${distinct.nonKorean.toLocaleString("en-US")} |\n\n` +
  `Semantic translation appears in ${row.semanticRowPercent}% of Korean menu rows and covers ${row.semanticCharacterPercent}% of Hangul characters. Romanization is not counted as translation.\n\n` +
  `## Highest-frequency unresolved names\n\n` +
  `| Korean | Current English display | Rows | Unresolved segments |\n| --- | --- | ---: | --- |\n` +
  unresolvedNames.slice(0, 100).map(item =>
    `| ${item.korean.replaceAll("|", "\\|")} | ${item.english.replaceAll("|", "\\|")} | ${item.rows} | ${item.unknownSegments.join(", ").replaceAll("|", "\\|")} |`
  ).join("\n") + "\n";

fs.writeFileSync(markdownPath, markdown);
console.log(`Wrote ${path.relative(root, jsonPath)} and ${path.relative(root, markdownPath)}`);
console.log(JSON.stringify({ rowCoverage: row, uniqueNameCoverage: distinct }, null, 2));

