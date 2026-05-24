import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "..", "..");
const defaultDraftRoot = path.join(projectRoot, "data-exports", "content-automation");

function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
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

function normalizeCount(value) {
  const count = Number.parseInt(String(value ?? "7"), 10);
  if (!Number.isFinite(count) || count < 1 || count > 30) {
    throw new Error("--count must be a number between 1 and 30.");
  }
  return count;
}

function compactKoreanFolderName(value) {
  const compact = value
    .replace(/\s+/g, "")
    .replace(/[\\/:*?"<>|]/g, "")
    .replace(/[^\p{L}\p{N}._-]/gu, "");

  return compact || `topic-${Date.now()}`;
}

function slugify(value) {
  const hash = crypto.createHash("sha1").update(value).digest("hex").slice(0, 8);
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (/[^\x00-\x7F]/.test(value)) {
    return ascii ? `${ascii.slice(0, 64)}-${hash}` : `topic-${hash}`;
  }

  if (ascii) {
    return ascii.slice(0, 80);
  }

  return `topic-${hash}`;
}

function stableId(prefix, value) {
  return `${prefix}_${crypto.createHash("sha1").update(value).digest("hex").slice(0, 12)}`;
}

function inferRegion(topic, explicitRegion) {
  if (explicitRegion) {
    return explicitRegion;
  }

  const knownRegionMatch = topic.match(
    /(서울|강남|성수|홍대|연남|잠실|동탄|수원|용인|분당|판교|부산|해운대|광안리|대구|인천|대전|광주|제주|대학로|을지로|종로|여의도|합정|망원|상수|이태원|한남|서촌|북촌|압구정|신사|역삼|삼성|송도|일산|파주|춘천|강릉|속초|전주|여수|경주)/
  );

  return knownRegionMatch?.[1] ?? "";
}

function buildSearchQueries({ topic, region, count }) {
  const base = topic.replace(/\s+/g, " ").trim();
  const regionPrefix = region || base.replace(/BEST\s*\d+/i, "").trim();
  const countText = `${count}곳`;

  return [
    {
      intent: "topic-overview",
      engine: "google",
      query: `${base} 추천`,
      collect: ["candidate restaurants", "repeated names", "recent list posts"],
    },
    {
      intent: "topic-overview",
      engine: "naver",
      query: `${base} 블로그`,
      collect: ["candidate restaurants", "menu mentions", "address mentions"],
    },
    {
      intent: "instagram-evidence",
      engine: "google",
      query: `site:instagram.com ${base}`,
      collect: ["real image candidates", "caption text", "hashtags"],
    },
    {
      intent: "menu-price",
      engine: "google",
      query: `${regionPrefix} 맛집 메뉴 가격`,
      collect: ["menu names", "prices", "menu board images"],
    },
    {
      intent: "address-check",
      engine: "google",
      query: `${regionPrefix} ${countText} 맛집 주소`,
      collect: ["address candidates", "official pages", "map snippets visible on web"],
    },
    {
      intent: "freshness",
      engine: "naver",
      query: `${base} 최신`,
      collect: ["recent posts", "closed or moved warnings", "new restaurants"],
    },
  ];
}

function buildTopicDraft({ topic, region, count, folderName, slug, now }) {
  const id = stableId("planned_topic", `${topic}|${region}|${count}`);

  return {
    schemaVersion: 1,
    id,
    slug,
    title: topic,
    type: "planned_topic",
    contentMode: "web_research",
    region,
    targetRestaurantCount: count,
    status: "research-planned",
    outputFolder: folderName,
    card: {
      ratio: "4:5",
      width: 1080,
      height: 1350,
      requiresRealImages: true,
      textRendering: "code-rendered",
    },
    seo: {
      title: `${topic} | 맛픽`,
      description: `${topic} 후보를 실제 웹 출처, 메뉴, 가격, 주소 근거와 함께 정리하는 맛픽 자동화 초안입니다.`,
      tags: Array.from(new Set([topic, region, `${region} 맛집`, "맛픽"])).filter(Boolean),
    },
    policy: {
      placeApi: "disabled",
      browsing: "required",
      imageUsageReview: "required-before-publish",
      minimumIndependentSources: 2,
    },
    searchPlan: buildSearchQueries({ topic, region, count }),
    restaurantIds: [],
    generatedAt: now,
  };
}

function buildRestaurantDraft({ topicId }) {
  return {
    schemaVersion: 1,
    topicId,
    status: "empty-research-draft",
    restaurants: [],
    candidateSchema: {
      id: "string",
      name: "string",
      aliases: ["string"],
      region: "string",
      address: "string",
      category: "string",
      representativeMenu: "string",
      lat: "number|null",
      lng: "number|null",
      menus: [
        {
          name: "string",
          price: "string",
          isSignature: "boolean",
          sourceId: "string",
          observedAt: "ISO date",
          confidence: "0-100",
        },
      ],
      imageCandidates: ["image source id"],
      evidence: ["source id"],
      confidence: "0-100",
      reviewStatus: "needs-review|approved|blocked",
    },
  };
}

function buildSourcesDraft({ topicId, searchPlan, now }) {
  return {
    schemaVersion: 1,
    topicId,
    status: "search-plan-created",
    plannedSearches: searchPlan.map((item, index) => ({
      id: `search_${String(index + 1).padStart(2, "0")}`,
      ...item,
      status: "pending",
    })),
    sources: [],
    sourceSchema: {
      id: "string",
      platform: "google|naver|instagram|blog|official|article|other",
      url: "string",
      title: "string",
      author: "string",
      publishedAt: "ISO date|null",
      capturedAt: "ISO date",
      rawText: "string",
      ocrText: "string",
      extractedFacts: ["restaurant|menu|price|address|image"],
    },
    createdAt: now,
  };
}

function buildImageSourcesDraft({ topicId, now }) {
  return {
    schemaVersion: 1,
    topicId,
    status: "empty-image-draft",
    policy: {
      requiresRealImages: true,
      allowedUsageStatusesForPublish: ["official", "licensed", "own"],
      defaultUsageStatus: "needs-review",
      blockedUsageStatus: "blocked",
    },
    images: [],
    imageSchema: {
      id: "string",
      restaurantId: "string|null",
      url: "string",
      localPath: "string",
      sourceUrl: "string",
      platform: "instagram|blog|official|article|other",
      author: "string",
      caption: "string",
      usageStatus: "needs-review|official|licensed|own|blocked",
      capturedAt: "ISO date",
    },
    createdAt: now,
  };
}

function buildEvidenceReport({ topicId, now }) {
  return {
    schemaVersion: 1,
    topicId,
    status: "not-started",
    thresholds: {
      autoApprove: 95,
      review: 80,
      holdBelow: 80,
    },
    scoring: {
      restaurant: {
        repeatedAcrossSources: 25,
        addressAgreement: 25,
        menuPriceEvidence: 20,
        realImageCandidate: 15,
        topicFit: 10,
        freshness: 5,
      },
      penalties: {
        sponsoredOnlyEvidence: -15,
        addressConflict: -30,
        noRealImage: -15,
        noMenuOrPrice: -15,
      },
    },
    findings: [],
    createdAt: now,
  };
}

function buildRunLog({ args, outputDir, now }) {
  return {
    schemaVersion: 1,
    command: "matpick:research-topic",
    args,
    outputDir,
    steps: [
      {
        name: "create-draft-workspace",
        status: "completed",
        completedAt: now,
      },
      {
        name: "browser-research",
        status: "pending",
        note: "Attach Playwright/cloud worker in the next automation phase.",
      },
      {
        name: "restaurant-extraction",
        status: "pending",
      },
      {
        name: "card-rendering",
        status: "pending",
      },
    ],
  };
}

async function writeJson(filePath, payload) {
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const topic = requireText(args.topic, "topic");
  const region = inferRegion(topic, typeof args.region === "string" ? args.region.trim() : "");
  const count = normalizeCount(args.count);
  const now = new Date().toISOString();
  const folderName = compactKoreanFolderName(args.folder || topic);
  const slug = slugify(args.slug || topic);
  const outRoot = path.resolve(args["out-root"] || defaultDraftRoot);
  const outputDir = path.join(outRoot, folderName);

  await mkdir(outputDir, { recursive: true });

  const topicDraft = buildTopicDraft({ topic, region, count, folderName, slug, now });
  const restaurantsDraft = buildRestaurantDraft({ topicId: topicDraft.id });
  const sourcesDraft = buildSourcesDraft({
    topicId: topicDraft.id,
    searchPlan: topicDraft.searchPlan,
    now,
  });
  const imageSourcesDraft = buildImageSourcesDraft({ topicId: topicDraft.id, now });
  const evidenceReport = buildEvidenceReport({ topicId: topicDraft.id, now });
  const runLog = buildRunLog({ args, outputDir, now });

  await Promise.all([
    writeJson(path.join(outputDir, "topic.json"), topicDraft),
    writeJson(path.join(outputDir, "restaurants.json"), restaurantsDraft),
    writeJson(path.join(outputDir, "sources.json"), sourcesDraft),
    writeJson(path.join(outputDir, "image-sources.json"), imageSourcesDraft),
    writeJson(path.join(outputDir, "evidence-report.json"), evidenceReport),
    writeJson(path.join(outputDir, "run-log.json"), runLog),
  ]);

  console.log(`Matpick automation draft created: ${outputDir}`);
  console.log(`Topic: ${topicDraft.title}`);
  console.log(`Planned searches: ${topicDraft.searchPlan.length}`);
  console.log("Next: run a browser research worker to fill sources.json and restaurants.json.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
