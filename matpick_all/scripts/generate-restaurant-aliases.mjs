import { readFile, readdir, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { loadPublicData, projectRoot } from "./load-public-data.mjs";

const data = await loadPublicData();
const dataDir = path.join(projectRoot, "client/src/data");
const aliasesPath = path.join(dataDir, "legacy-restaurant-aliases.json");
const aliases = JSON.parse(await readFile(aliasesPath, "utf8"));
const previousAliasPaths = new Set(Object.keys(aliases).map(id => `/restaurant/${id}`));
const canonicalIds = new Set(data.restaurants.map(restaurant => restaurant.id));
const byIdentity = new Map();
for (const restaurant of data.restaurants) {
  for (const key of data.buildRestaurantLookupKeys(restaurant)) {
    const ids = byIdentity.get(key) ?? new Set();
    ids.add(restaurant.id);
    byIdentity.set(key, ids);
  }
}
const files = [path.join(dataDir, "matpick-data.json")];
for (const directory of ["generated", "generated/topic-enrichments"]) {
  for (const entry of await readdir(path.join(dataDir, directory), {
    withFileTypes: true,
  })) {
    if (entry.isFile() && /\.(generated|enriched)\.json$/.test(entry.name))
      files.push(path.join(dataDir, directory, entry.name));
  }
}
const unresolved = [];
for (const filename of files.sort()) {
  const source = JSON.parse(
    (await readFile(filename, "utf8")).replace(/^\uFEFF/, "")
  );
  for (const restaurant of source.restaurants ?? []) {
    if (canonicalIds.has(restaurant.id)) continue;
    const candidates = new Set(
      data
        .buildRestaurantLookupKeys(restaurant)
        .flatMap(key => [...(byIdentity.get(key) ?? [])])
    );
    if (candidates.size === 1) aliases[restaurant.id] = [...candidates][0];
    else
      unresolved.push({
        id: restaurant.id,
        name: restaurant.name,
        address: restaurant.address,
        candidates: [...candidates],
      });
  }
}
for (const [alias, target] of Object.entries(data.restaurantAliases))
  aliases[alias] = target;
const sortedAliases = Object.fromEntries(
  Object.entries(aliases).filter(([alias, target]) => !canonicalIds.has(alias) && canonicalIds.has(target))
    .sort(([a], [b]) => a.localeCompare(b))
);
await writeFile(aliasesPath, JSON.stringify(sortedAliases, null, 2) + "\n");
await mkdir(path.join(projectRoot, "reports"), { recursive: true });
await writeFile(
  path.join(projectRoot, "reports/alias-review.json"),
  JSON.stringify(
    { aliasCount: Object.keys(aliases).length, unresolved },
    null,
    2
  ) + "\n"
);

// Vercel serves permanent legacy redirects before the SPA rewrite.
const vercelPath = path.resolve(projectRoot, "../vercel.json");
const config = JSON.parse(await readFile(vercelPath, "utf8"));
const generated = Object.entries(sortedAliases).map(([alias, target]) => ({
  source: `/restaurant/${alias}`,
  destination: `/restaurant/${target}`,
  permanent: true,
}));
const ownedSources = new Set(generated.map(redirect => redirect.source));
config.redirects = [
  ...(config.redirects ?? []).filter(
    redirect => !ownedSources.has(redirect.source) && !previousAliasPaths.has(redirect.source)
  ),
  ...generated,
];
await writeFile(vercelPath, JSON.stringify(config, null, 2) + "\n");
console.log(
  `Preserved ${generated.length} restaurant aliases; ambiguous/unmatched records saved for review.`
);
