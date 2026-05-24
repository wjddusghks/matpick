import crypto from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const defaultOutRoot = path.join(projectRoot, "data-exports", "content-automation");
const supportedImageExtensions = new Set([".png", ".jpg", ".jpeg", ".webp"]);

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (part === "--") {
      continue;
    }
    if (!part.startsWith("--")) {
      continue;
    }

    const key = part.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }

    args[key] = next;
    index += 1;
  }

  return args;
}

function requireText(value, label) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) {
    throw new Error(`Missing required argument: --${label}`);
  }
  return text;
}

function normalizeCount(value, fallback = 7) {
  const count = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(count) || count < 1 || count > 50) {
    throw new Error("--count must be a number between 1 and 50.");
  }
  return count;
}

function slugify(value) {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (normalized) {
    return normalized;
  }

  return `topic-${crypto.createHash("sha1").update(value).digest("hex").slice(0, 8)}`;
}

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

function normalizeFolderName(value) {
  return value
    .replace(/\s+/g, "-")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function readCardFolder(cardFolder) {
  if (!cardFolder || typeof cardFolder !== "string") {
    return [];
  }

  const folderPath = path.resolve(projectRoot, cardFolder);
  const entries = await readdir(folderPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const extension = path.extname(entry.name).toLowerCase();
      return {
        fileName: entry.name,
        extension,
        absolutePath: path.join(folderPath, entry.name),
        relativePath: path.relative(projectRoot, path.join(folderPath, entry.name)),
      };
    })
    .filter((entry) => supportedImageExtensions.has(entry.extension))
    .sort((left, right) =>
      left.fileName.localeCompare(right.fileName, "ko", {
        numeric: true,
        sensitivity: "base",
      })
    );
}

function isCoverImage(fileName) {
  return /메인|cover|main|00/i.test(fileName);
}

function buildTextSlots({ topic, region, count, index }) {
  if (index === 0) {
    return {
      eyebrow: region ? `${region}에서 고를 때` : "지금 가볼 만한 맛집",
      title: topic,
      subtitle: `${count}곳을 지도와 함께 바로 볼 수 있게 정리합니다.`,
      chips: region ? [region, "맛집", "지도 보기"] : ["맛집", "지도 보기"],
    };
  }

  return {
    rank: index,
    title: "식당명 입력",
    subtitle: "대표 메뉴와 가격 입력",
    addressLine: "주소 검증 후 입력",
  };
}

function buildPrompt({ topic, region, style, card, count }) {
  if (card.type === "cover") {
    return [
      "Create one 4:5 portrait Matpick Korean food topic cover card, 1080x1350.",
      `Style: ${style}, readable Hangul, Matpick coral accents, polished Instagram card-news layout.`,
      `Exact title: "${topic}"`,
      `Subtitle: "${card.textSlots.subtitle}"`,
      `Region: "${region || "지역 미정"}"`,
      `Count: ${count}`,
      "Visual: appetizing generated food-guide composition for a local restaurant list.",
      "Rules: no logos, no watermarks, no QR codes, no fake creator handle, no CATCHABLE label, no extra restaurant names, no copied storefront.",
    ].join("\n");
  }

  return [
    "Create one 4:5 portrait Matpick Korean restaurant card, 1080x1350.",
    `Style: ${style}, readable Hangul, Matpick coral accents, clean mobile-first card-news layout.`,
    'Exact title: "<verified restaurant name>"',
    'Subtitle: "<representative menu> <verified price>"',
    'Small address: "<short verified address>"',
    "Visual: realistic generated food photography matching the verified representative menu.",
    "Rules: no logos, no watermarks, no QR codes, no fake awards, no CATCHABLE label, no extra restaurant names, no extra prices, no copied storefront.",
  ].join("\n");
}

function buildCards({ topic, region, count, slug, style, images }) {
  const coverImage = images.find((image) => isCoverImage(image.fileName));
  const restaurantImages = images.filter((image) => !isCoverImage(image.fileName));
  const totalRestaurantCards = Math.max(count, restaurantImages.length);
  const cards = [];

  cards.push({
    id: `${slug}-cover`,
    type: "cover",
    order: 0,
    ratio: "4:5",
    width: 1080,
    height: 1350,
    sourceImage: coverImage?.relativePath ?? null,
    targetFileName: "00-cover.webp",
    textSlots: buildTextSlots({ topic, region, count, index: 0 }),
    status: coverImage ? "source-image-detected" : "needs-generation",
  });

  for (let index = 1; index <= totalRestaurantCards; index += 1) {
    const image = restaurantImages[index - 1];
    const order = String(index).padStart(2, "0");
    cards.push({
      id: `${slug}-restaurant-${order}`,
      type: "restaurant",
      order: index,
      ratio: "4:5",
      width: 1080,
      height: 1350,
      restaurantId: null,
      sourceImage: image?.relativePath ?? null,
      targetFileName: `${order}-restaurant.webp`,
      textSlots: buildTextSlots({ topic, region, count, index }),
      status: image ? "source-image-detected" : "needs-generation",
    });
  }

  return cards.map((card) => ({
    ...card,
    prompt: buildPrompt({ topic, region, style, card, count }),
  }));
}

function buildTopic({ topic, slug, region, count, type, sourceId, now }) {
  return {
    schemaVersion: 1,
    id: stableId("topic", `${sourceId}|${slug}|${topic}`),
    slug,
    title: topic,
    shortTitle: topic.replace(/\s*BEST\s*/i, " BEST").slice(0, 24),
    type,
    sourceId,
    region,
    areaLabel: region.split(/\s+/).at(-1) ?? region,
    status: "automation-prepared",
    targetCount: count,
    restaurantIds: [],
    purposeTags: [],
    seo: {
      title: `${topic} | 맛픽`,
      description: `${topic}을 식당명, 메뉴, 가격, 주소, 지도와 함께 정리하는 맛픽 카드 초안입니다.`,
      tags: Array.from(new Set([topic, region, `${region} 맛집`, "맛픽"].filter(Boolean))),
    },
    createdAt: now,
  };
}

function buildRestaurants({ topicId }) {
  return {
    schemaVersion: 1,
    topicId,
    status: "needs-research",
    restaurants: [],
    requiredFields: [
      "id",
      "name",
      "region",
      "address",
      "lat",
      "lng",
      "category",
      "representativeMenu",
      "menus",
      "imageUrl",
      "seoTags",
      "evidence",
      "reviewStatus",
    ],
    menuPolicy: {
      priceRequired: true,
      sourceRequired: true,
      observedAtRequired: true,
    },
  };
}

function buildSources({ topicId, now }) {
  return {
    schemaVersion: 1,
    topicId,
    status: "needs-research",
    sources: [],
    sourceSchema: {
      id: "string",
      platform: "instagram|blog|official|article|map-web|menu-image|other",
      url: "string",
      title: "string",
      author: "string",
      publishedAt: "ISO date|null",
      capturedAt: "ISO date",
      rawText: "string",
      facts: ["restaurant-name", "address", "coordinate", "menu", "price", "image"],
      confidence: "0-100",
    },
    createdAt: now,
  };
}

function buildPublishPlan({ slug, sourceId, type, cards }) {
  const publicAssetRoot = `/card-data/${sourceId}/${slug}`;

  return {
    schemaVersion: 1,
    status: "draft-only",
    liveWriteAllowed: false,
    publicAssetRoot,
    targetFiles: {
      publicAssets: `matpick_all/client/public${publicAssetRoot}/`,
      topicEnrichment: `matpick_all/client/src/data/generated/topic-enrichments/${sourceId}.enriched.json`,
      mapCollections: "matpick_all/client/src/data/mapCollections.ts",
    },
    cardImageUrls: cards.map((card) => `${publicAssetRoot}/${card.targetFileName}`),
    integrationRules: {
      sourceTopic: type === "episode" || type === "source_topic",
      generalCardCollection: type === "general_card" || type === "planned_topic",
      mapShouldUseExplicitRestaurantIds: true,
    },
    steps: [
      "Fill sources.json with research evidence.",
      "Fill restaurants.json with verified canonical restaurant data.",
      "Generate or approve every 4:5 card asset in card-spec.json.",
      "Copy final webp assets to the public asset target.",
      "Update topic enrichment data and mapCollections only after review.",
      "Run TypeScript check and browser QA before commit.",
    ],
  };
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const topic = requireText(args.topic, "topic");
  const region = typeof args.region === "string" ? args.region.trim() : "";
  const sourceId = typeof args.source === "string" ? args.source.trim() : "popular-restaurants";
  const type = typeof args.type === "string" ? args.type.trim() : "general_card";
  const style = typeof args.style === "string" ? args.style.trim() : "Matpick Editorial 4:5";
  const slug = slugify(args.slug || topic);
  const count = normalizeCount(args.count);
  const outRoot = path.resolve(projectRoot, args["out-root"] || defaultOutRoot);
  const outputDir = path.join(outRoot, normalizeFolderName(slug));
  const now = new Date().toISOString();
  const images = await readCardFolder(args["card-folder"]);
  const topicDraft = buildTopic({ topic, slug, region, count, type, sourceId, now });
  const cards = buildCards({ topic, region, count, slug, style, images });
  const cardSpec = {
    schemaVersion: 1,
    topicId: topicDraft.id,
    style,
    ratio: "4:5",
    width: 1080,
    height: 1350,
    cards,
    designRules: [
      "No CATCHABLE label.",
      "No copied logos, watermarks, QR codes, fake awards, or creator handles.",
      "Food visual must match verified representative menu.",
      "Keep text readable on mobile.",
      "Use one image file per card.",
    ],
  };
  const cardPrompts = {
    schemaVersion: 1,
    topicId: topicDraft.id,
    prompts: cards.map((card) => ({
      cardId: card.id,
      targetFileName: card.targetFileName,
      prompt: card.prompt,
    })),
  };
  const publishPlan = buildPublishPlan({ slug, sourceId, type, cards });
  const runLog = {
    schemaVersion: 1,
    command: "matpick:prepare-card-topic",
    args,
    outputDir,
    detectedImages: images.length,
    status: "prepared",
    createdAt: now,
  };

  if (args["dry-run"]) {
    console.log(JSON.stringify({ outputDir, topic: topicDraft, cards: cards.length }, null, 2));
    return;
  }

  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeJson(path.join(outputDir, "topic.json"), topicDraft),
    writeJson(path.join(outputDir, "restaurants.json"), buildRestaurants({ topicId: topicDraft.id })),
    writeJson(path.join(outputDir, "sources.json"), buildSources({ topicId: topicDraft.id, now })),
    writeJson(path.join(outputDir, "card-spec.json"), cardSpec),
    writeJson(path.join(outputDir, "card-prompts.json"), cardPrompts),
    writeJson(path.join(outputDir, "publish-plan.json"), publishPlan),
    writeJson(path.join(outputDir, "run-log.json"), runLog),
  ]);

  console.log(`Matpick card automation draft prepared: ${outputDir}`);
  console.log(`Cards: ${cards.length}`);
  console.log("Next: fill sources/restaurants, then generate or approve final 4:5 assets.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
