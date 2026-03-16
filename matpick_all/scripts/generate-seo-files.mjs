import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const clientRoot = path.join(projectRoot, "client");
const publicDir = path.join(clientRoot, "public");
const sourceAsset = path.join(clientRoot, "src", "assets", "matpick-logo-final 2.png");
const baseDataPath = path.join(clientRoot, "src", "data", "matpick-data.json");
const oldKorean100Path = path.join(
  clientRoot,
  "src",
  "data",
  "generated",
  "old-korean-100.generated.json"
);

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

async function ensurePublicAssets() {
  await mkdir(publicDir, { recursive: true });
  await copyFile(sourceAsset, path.join(publicDir, "favicon.png"));
  await copyFile(sourceAsset, path.join(publicDir, "apple-touch-icon.png"));
  await copyFile(sourceAsset, path.join(publicDir, "og-default.png"));
}

async function buildSitemap(siteUrl) {
  const baseDataset = await readJson(baseDataPath);
  const oldKorean100Dataset = await readJson(oldKorean100Path);
  const restaurants = [...(baseDataset.restaurants || []), ...(oldKorean100Dataset.restaurants || [])];
  const creators = baseDataset.creators || [];
  const today = new Date().toISOString();
  const seen = new Set();

  const staticUrls = ["/", "/explore", "/map", "/about", "/privacy", "/terms", "/contact"];
  const entries = [];

  for (const item of staticUrls) {
    entries.push(item);
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
