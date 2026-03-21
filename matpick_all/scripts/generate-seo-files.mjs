import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const clientRoot = path.join(projectRoot, "client");
const publicDir = path.join(clientRoot, "public");
const sourceAsset = path.join(clientRoot, "src", "assets", "matpick-logo-final 2.png");
const baseDataPath = path.join(clientRoot, "src", "data", "matpick-data.json");
const generatedDir = path.join(clientRoot, "src", "data", "generated");
const topicEnrichmentDir = path.join(generatedDir, "topic-enrichments");
const discoveryTopicsPath = path.join(clientRoot, "src", "data", "discovery-topics.json");
const hiddenCreatorIds = new Set(["UCfpaSruWW3S4dibonKXENjA"]);

function normalizeUrl(value) {
  return (value || "https://matpick.co.kr").replace(/\/$/, "");
}

function xmlEscape(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function stripAdsensePublisher(client) {
  return client.replace(/^ca-/, "");
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw.replace(/^\uFEFF/, ""));
}

function slugifyTopicSegment(value) {
  const normalized = String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

  const slug = normalized
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "episode";
}

function sortVisitsByDate(a, b) {
  return String(b.visitDate || "").localeCompare(String(a.visitDate || ""), "ko-KR");
}

function buildTopicEpisodes(discoveryTopics, creators, visits) {
  return discoveryTopics.flatMap((topic) => {
    if (topic.kind !== "creator") {
      return [];
    }

    const creator = creators.find((entry) => entry.id === topic.targetId);
    const creatorName = topic.name || creator?.name || topic.slug;
    const groupedVisits = new Map();

    visits
      .filter((visit) => visit.creatorId === topic.targetId)
      .sort(sortVisitsByDate)
      .forEach((visit) => {
        const groupKey = visit.videoId || visit.episode || visit.videoTitle || visit.id;
        const current = groupedVisits.get(groupKey) ?? [];
        current.push(visit);
        groupedVisits.set(groupKey, current);
      });

    const usedSlugs = new Set();

    return Array.from(groupedVisits.values())
      .map((episodeVisits) => {
        const firstVisit = [...episodeVisits].sort(sortVisitsByDate)[0];
        const episodeLabel =
          firstVisit?.episode?.trim() ||
          firstVisit?.videoTitle?.trim() ||
          firstVisit?.videoId?.trim() ||
          "회차";
        const baseSlug = slugifyTopicSegment(episodeLabel);
        let episodeSlug = baseSlug;

        if (usedSlugs.has(episodeSlug)) {
          episodeSlug = `${baseSlug}-${slugifyTopicSegment(firstVisit.videoId || firstVisit.id)}`;
        }
        usedSlugs.add(episodeSlug);

        return {
          topicSlug: topic.slug,
          slug: episodeSlug,
          name: creatorName,
        };
      })
      .filter(Boolean);
  });
}

async function readGeneratedDatasets() {
  const entries = await readdir(generatedDir, { withFileTypes: true });
  const datasetFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".generated.json"))
    .map((entry) => path.join(generatedDir, entry.name));

  return Promise.all(datasetFiles.map((filePath) => readJson(filePath)));
}

async function readTopicEnrichments() {
  const entries = await readdir(topicEnrichmentDir, { withFileTypes: true });
  const datasetFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".enriched.json"))
    .map((entry) => path.join(topicEnrichmentDir, entry.name));

  return Promise.all(datasetFiles.map((filePath) => readJson(filePath)));
}

function filterVisibleCreatorData(creators = [], visits = []) {
  return {
    creators: creators.filter((creator) => !hiddenCreatorIds.has(creator.id)),
    visits: visits.filter((visit) => !hiddenCreatorIds.has(visit.creatorId)),
  };
}

async function ensurePublicAssets() {
  await mkdir(publicDir, { recursive: true });
  await copyFile(sourceAsset, path.join(publicDir, "favicon.png"));
  await copyFile(sourceAsset, path.join(publicDir, "apple-touch-icon.png"));
  await copyFile(sourceAsset, path.join(publicDir, "og-default.png"));
}

async function buildSitemap(siteUrl) {
  const baseDataset = await readJson(baseDataPath);
  const generatedDatasets = await readGeneratedDatasets();
  const topicEnrichments = await readTopicEnrichments();
  const discoveryTopics = await readJson(discoveryTopicsPath);
  const { creators, visits } = filterVisibleCreatorData(
    baseDataset.creators || [],
    baseDataset.visits || []
  );
  const visibleRestaurantIds = new Set([
    ...visits.map((visit) => visit.restaurantId).filter(Boolean),
    ...topicEnrichments.flatMap((dataset) =>
      (dataset.sourceLinks || []).map((link) => link.restaurantId).filter(Boolean)
    ),
  ]);
  const topicEpisodes = buildTopicEpisodes(
    discoveryTopics,
    creators,
    visits
  );
  const restaurants = [
    ...(baseDataset.restaurants || []),
    ...generatedDatasets.flatMap((dataset) => dataset.restaurants || []),
    ...topicEnrichments.flatMap((dataset) => dataset.restaurants || []),
  ].filter(
    (restaurant) =>
      visibleRestaurantIds.size === 0 || visibleRestaurantIds.has(restaurant.id)
  );
  const today = new Date().toISOString();
  const seen = new Set();

  const staticUrls = ["/", "/explore", "/map", "/reviews", "/about", "/privacy", "/terms", "/contact"];
  const entries = [];

  for (const item of staticUrls) {
    entries.push(item);
  }

  for (const topic of discoveryTopics) {
    entries.push(`/explore/topic/${topic.slug}`);
  }

  for (const episode of topicEpisodes) {
    entries.push(`/explore/topic/${episode.topicSlug}/episode/${episode.slug}`);
  }

  for (const creator of creators) {
    entries.push(`/creator/${creator.id}`);
  }

  for (const restaurant of restaurants) {
    if (seen.has(restaurant.id)) {
      continue;
    }
    seen.add(restaurant.id);
    entries.push(`/restaurant/${restaurant.id}`);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
  .map(
    (entry) => `  <url>
    <loc>${xmlEscape(`${siteUrl}${entry}`)}</loc>
    <lastmod>${today}</lastmod>
  </url>`
  )
  .join("\n")}
</urlset>
`;

  await writeFile(path.join(publicDir, "sitemap.xml"), xml, "utf8");
}

async function buildRobots(siteUrl) {
  const content = `User-agent: *
Allow: /

Sitemap: ${siteUrl}/sitemap.xml
`;

  await writeFile(path.join(publicDir, "robots.txt"), content, "utf8");
}

async function buildAdsTxt() {
  const adsenseClient = process.env.VITE_ADSENSE_CLIENT?.trim() || "";
  if (!adsenseClient) {
    await writeFile(
      path.join(publicDir, "ads.txt"),
      "# Add your AdSense publisher ID in VITE_ADSENSE_CLIENT to generate a valid ads.txt\n",
      "utf8"
    );
    return;
  }

  const publisher = stripAdsensePublisher(adsenseClient);
  const content = `google.com, ${publisher}, DIRECT, f08c47fec0942fa0\n`;
  await writeFile(path.join(publicDir, "ads.txt"), content, "utf8");
}

async function buildManifest() {
  const manifest = {
    name: "Matpick",
    short_name: "Matpick",
    start_url: "/",
    display: "standalone",
    background_color: "#fff8f9",
    theme_color: "#ff7b83",
    lang: "ko-KR",
    icons: [
      {
        src: "/favicon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };

  await writeFile(path.join(publicDir, "site.webmanifest"), JSON.stringify(manifest, null, 2), "utf8");
}

async function main() {
  const siteUrl = normalizeUrl(process.env.VITE_PUBLIC_APP_URL);
  await ensurePublicAssets();
  await buildSitemap(siteUrl);
  await buildRobots(siteUrl);
  await buildAdsTxt();
  await buildManifest();
}

main().catch((error) => {
  console.error("Failed to generate SEO files:", error);
  process.exitCode = 1;
});
