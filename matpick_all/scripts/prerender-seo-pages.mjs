import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const baseDataPath = path.join(projectRoot, "client", "src", "data", "matpick-data.json");
const generatedDir = path.join(projectRoot, "client", "src", "data", "generated");
const topicEnrichmentDir = path.join(generatedDir, "topic-enrichments");
const discoveryTopicsPath = path.join(projectRoot, "client", "src", "data", "discovery-topics.json");
const hiddenCreatorIds = new Set(["UCfpaSruWW3S4dibonKXENjA"]);

function normalizeUrl(value) {
  return (value || "https://matpick.co.kr").replace(/\/$/, "");
}

function normalizeText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function absoluteUrl(siteUrl, value = "/") {
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return value;
  }

  return `${siteUrl}${value.startsWith("/") ? value : `/${value}`}`;
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

        const restaurantIds = Array.from(
          new Set(episodeVisits.map((visit) => visit.restaurantId).filter(Boolean))
        );
        const videoTitle = firstVisit?.videoTitle?.trim() || `${creatorName} ${episodeLabel}`;

        return {
          topicSlug: topic.slug,
          topicName: creatorName,
          slug: episodeSlug,
          episode: episodeLabel,
          title: videoTitle,
          restaurantIds,
          description: `${creatorName} ${episodeLabel}에 소개된 맛집 ${restaurantIds.length}곳을 모아봤어요.`,
        };
      })
      .filter((episode) => episode.restaurantIds.length > 0);
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

function filterVisibleSeoDataset({ creators = [], visits = [], restaurants = [], sourceLinks = [] }) {
  const visibleCreators = creators.filter((creator) => !hiddenCreatorIds.has(creator.id));
  const visibleVisits = visits.filter((visit) => !hiddenCreatorIds.has(visit.creatorId));
  const visibleRestaurantIds = new Set([
    ...visibleVisits.map((visit) => visit.restaurantId).filter(Boolean),
    ...sourceLinks.map((link) => link.restaurantId).filter(Boolean),
  ]);

  return {
    creators: visibleCreators,
    visits: visibleVisits,
    restaurants: restaurants.filter(
      (restaurant) =>
        visibleRestaurantIds.size === 0 || visibleRestaurantIds.has(restaurant.id)
    ),
  };
}

function buildLookupKey(restaurant) {
  return `${normalizeText(restaurant.name).toLowerCase()}|${normalizeText(restaurant.address).toLowerCase()}`;
}

function mergeDatasets(base, extras) {
  const mergedRestaurants = [...(base.restaurants ?? [])];
  const mergedCreators = [...(base.creators ?? [])];
  const existing = new Map(mergedRestaurants.map((restaurant, index) => [buildLookupKey(restaurant), index]));

  for (const extra of extras) {
    for (const restaurant of extra.restaurants ?? []) {
      const key = buildLookupKey(restaurant);
      const existingIndex = existing.get(key);
      if (existingIndex == null) {
        existing.set(key, mergedRestaurants.length);
        mergedRestaurants.push(restaurant);
        continue;
      }

      const current = mergedRestaurants[existingIndex];
      mergedRestaurants[existingIndex] = {
        ...current,
        foundingYear: current.foundingYear ?? restaurant.foundingYear ?? null,
        menus: current.menus?.length ? current.menus : restaurant.menus ?? [],
        thumbnailFileName: current.thumbnailFileName ?? restaurant.thumbnailFileName ?? null,
        lat: current.lat || restaurant.lat || 0,
        lng: current.lng || restaurant.lng || 0,
      };
    }
  }

  return {
    creators: mergedCreators,
    restaurants: mergedRestaurants,
  };
}

function replaceTag(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html;
}

function injectJsonLd(html, jsonLd) {
  const payload = JSON.stringify(jsonLd).replace(/</g, "\\u003c");
  const scriptTag = `<script type="application/ld+json">${payload}</script>`;
  if (html.includes("</head>")) {
    return html.replace("</head>", `  ${scriptTag}\n  </head>`);
  }
  return `${html}\n${scriptTag}`;
}

function buildStaticFallback(metadata) {
  const content = metadata.staticContent ?? {};
  const paragraphs = [metadata.description, ...(content.paragraphs ?? [])]
    .map(normalizeText)
    .filter(Boolean);
  const facts = (content.facts ?? []).map(normalizeText).filter(Boolean);
  const links = (content.links ?? []).filter((link) => link?.href && link?.label);
  const uniqueLinks = Array.from(
    new Map(
      [
        ...links,
        { href: "/explore", label: "주제별 맛집 탐색" },
        { href: "/map", label: "맛집 지도" },
        { href: "/about", label: "Matpick 편집 기준" },
      ].map((link) => [link.href, link])
    ).values()
  ).slice(0, 16);

  return `<main data-static-fallback="true" style="min-height:100vh;background:#fffafa;color:#21191b;font-family:'Noto Sans KR',sans-serif">
    <header style="border-bottom:1px solid #f1e1e4;background:#fff;padding:18px 24px">
      <div style="max-width:960px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px">
        <a href="/" style="color:#e95869;font-size:20px;font-weight:800;text-decoration:none">Matpick</a>
        <span style="color:#766b6d;font-size:13px">출처와 맥락을 함께 보는 맛집 탐색</span>
      </div>
    </header>
    <article style="max-width:960px;margin:0 auto;padding:48px 24px 64px">
      <p style="margin:0 0 10px;color:#e95869;font-size:12px;font-weight:800;text-transform:uppercase">${escapeHtml(
        content.eyebrow ?? "Matpick Guide"
      )}</p>
      <h1 style="margin:0;font-size:34px;line-height:1.3">${escapeHtml(metadata.title)}</h1>
      <div style="max-width:760px;margin-top:24px;color:#5f5557;font-size:16px;line-height:1.9">
        ${paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      </div>
      ${
        facts.length > 0
          ? `<section style="margin-top:28px"><h2 style="font-size:20px">확인할 정보</h2><ul style="padding-left:20px;color:#5f5557;line-height:1.9">${facts
              .map((fact) => `<li>${escapeHtml(fact)}</li>`)
              .join("")}</ul></section>`
          : ""
      }
      <nav aria-label="관련 페이지" style="margin-top:32px;border-top:1px solid #f1e1e4;padding-top:24px">
        <h2 style="font-size:18px">관련 페이지</h2>
        <ul style="display:flex;flex-wrap:wrap;gap:10px 18px;padding:0;list-style:none">
          ${uniqueLinks
            .map(
              (link) =>
                `<li><a href="${escapeHtml(link.href)}" style="color:#d94e60;font-weight:700">${escapeHtml(
                  link.label
                )}</a></li>`
            )
            .join("")}
        </ul>
      </nav>
    </article>
  </main>`;
}

function renderHtml(template, metadata) {
  let html = template;
  html = replaceTag(html, /<title>.*?<\/title>/s, `<title>${escapeHtml(metadata.title)}</title>`);
  html = replaceTag(
    html,
    /<meta\s+name="description"\s+content=".*?"\s*\/?>/i,
    `<meta name="description" content="${escapeHtml(metadata.description)}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+name="robots"\s+content=".*?"\s*\/?>/i,
    `<meta name="robots" content="${escapeHtml(metadata.robots ?? "index,follow")}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:title"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:title" content="${escapeHtml(metadata.title)}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:description"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:description" content="${escapeHtml(metadata.description)}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:type"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:type" content="${escapeHtml(metadata.type ?? "website")}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:image"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:image" content="${escapeHtml(metadata.image)}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+property="og:url"\s+content=".*?"\s*\/?>/i,
    `<meta property="og:url" content="${escapeHtml(metadata.url)}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:title"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:title" content="${escapeHtml(metadata.title)}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:description"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:description" content="${escapeHtml(metadata.description)}" />`
  );
  html = replaceTag(
    html,
    /<meta\s+name="twitter:image"\s+content=".*?"\s*\/?>/i,
    `<meta name="twitter:image" content="${escapeHtml(metadata.image)}" />`
  );
  html = replaceTag(
    html,
    /<link\s+rel="canonical"\s+href=".*?"\s*\/?>/i,
    `<link rel="canonical" href="${escapeHtml(metadata.url)}" />`
  );

  if (metadata.adsenseClient) {
    const tag = `<meta name="google-adsense-account" content="${escapeHtml(metadata.adsenseClient)}" />`;
    if (/<meta\s+name="google-adsense-account"/i.test(html)) {
      html = replaceTag(
        html,
        /<meta\s+name="google-adsense-account"\s+content=".*?"\s*\/?>/i,
        tag
      );
    } else {
      html = html.replace("</head>", `  ${tag}\n  </head>`);
    }

  }

  html = html.replace(
    /<script type="application\/ld\+json">.*?<\/script>/gs,
    ""
  );

  if (metadata.jsonLd) {
    html = injectJsonLd(html, metadata.jsonLd);
  }

  html = html.replace(
    /<div id="root"><\/div>/,
    `<div id="root">${buildStaticFallback(metadata)}</div>`
  );

  return html;
}

async function writeRouteHtml(routePath, html) {
  const targetDir = path.join(distDir, routePath);
  await mkdir(targetDir, { recursive: true });
  await writeFile(path.join(targetDir, "index.html"), html, "utf8");
}

async function main() {
  const siteUrl = normalizeUrl(process.env.VITE_PUBLIC_APP_URL);
  const template = await readFile(path.join(distDir, "index.html"), "utf8");
  const baseData = await readJson(baseDataPath);
  const generatedDatasets = await readGeneratedDatasets();
  const topicEnrichments = await readTopicEnrichments();
  const discoveryTopics = await readJson(discoveryTopicsPath);
  const sourceLinks = topicEnrichments.flatMap((dataset) => dataset.sourceLinks || []);
  const { creators, restaurants } = filterVisibleSeoDataset({
    ...mergeDatasets(baseData, [...generatedDatasets, ...topicEnrichments]),
    visits: baseData.visits || [],
    sourceLinks,
  });
  const visibleVisits = (baseData.visits || []).filter(
    (visit) => !hiddenCreatorIds.has(visit.creatorId)
  );
  const topicEpisodes = buildTopicEpisodes(discoveryTopics, creators, visibleVisits);
  const defaultImage = absoluteUrl(siteUrl, "/og-default.png");
  const adsenseClient = process.env.VITE_ADSENSE_CLIENT?.trim() || "";
  const restaurantById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const restaurantLinks = (restaurantIds, limit = 12) =>
    Array.from(new Set(restaurantIds))
      .map((restaurantId) => restaurantById.get(restaurantId))
      .filter(Boolean)
      .slice(0, limit)
      .map((restaurant) => ({
        href: `/restaurant/${encodeURIComponent(restaurant.id)}`,
        label: restaurant.name,
      }));

  const homeHtml = renderHtml(template, {
    title: "맛픽 Matpick | 크리에이터 추천 맛집 지도",
    description:
      "유튜브, 방송, 가이드에 소개된 맛집을 한곳에서 찾고 지도와 상세 정보로 비교해보는 맛집 탐색 서비스.",
    url: absoluteUrl(siteUrl, "/"),
    image: defaultImage,
    type: "website",
    adsenseClient,
    staticContent: {
      eyebrow: "Curated Dining Discovery",
      paragraphs: [
        `Matpick은 ${restaurants.length.toLocaleString("ko-KR")}개 식당 정보를 출처, 지역, 음식 종류와 지도 좌표 기준으로 정리합니다. 방송·크리에이터·가이드별 목록을 같은 화면에서 비교하고 각 식당의 소개 맥락을 확인할 수 있습니다.`,
        "식당 카드 이미지는 탐색을 위한 자체 편집 자료이며, 주소·대표 메뉴·영업 상태는 확인 가능한 자료를 기준으로 계속 보완합니다.",
      ],
      links: discoveryTopics.slice(0, 10).map((topic) => ({
        href: `/explore/topic/${encodeURIComponent(topic.slug)}`,
        label: `${topic.name} 맛집`,
      })),
    },
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "Matpick",
      url: absoluteUrl(siteUrl, "/"),
      potentialAction: {
        "@type": "SearchAction",
        target: `${absoluteUrl(siteUrl, "/map")}?type=restaurant&value={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
  });
  await writeFile(path.join(distDir, "index.html"), homeHtml, "utf8");

  await writeRouteHtml(
    "explore",
    renderHtml(template, {
      title: "맛집 탐색 | 지역별 크리에이터 추천 맛집",
      description:
        "지역, 음식 종류, 크리에이터 기준으로 맛집을 탐색하고 상세 페이지로 이동할 수 있는 Matpick 탐색 페이지.",
      url: absoluteUrl(siteUrl, "/explore"),
      image: defaultImage,
      type: "website",
      adsenseClient,
      staticContent: {
        eyebrow: "Restaurant Collections",
        paragraphs: [
          `${discoveryTopics.length}개 주제에서 지역·음식 종류·출처를 조합해 식당을 찾을 수 있습니다. 결과마다 상세 정보와 지도 링크를 제공하며, 폐업이 확인된 식당은 기록을 지우지 않고 상태를 표시합니다.`,
        ],
        links: discoveryTopics.map((topic) => ({
          href: `/explore/topic/${encodeURIComponent(topic.slug)}`,
          label: topic.name,
        })),
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "맛집 탐색",
        url: absoluteUrl(siteUrl, "/explore"),
      },
    })
  );

  for (const topic of discoveryTopics) {
    const topicPath = `/explore/topic/${topic.slug}`;
    const topicTitle = `${topic.name} 맛집 탐색`;
    const topicDescription =
      topic.kind === "creator"
        ? `${topic.name}에서 소개된 맛집을 맛집 탐색 페이지에서 지역과 음식 기준으로 골라보세요.`
        : `${topic.name}에 포함된 맛집을 맛집 탐색 페이지에서 지역과 음식 기준으로 둘러보세요.`;
    const topicRestaurantIds =
      topic.kind === "creator"
        ? visibleVisits
            .filter((visit) => visit.creatorId === topic.targetId)
            .map((visit) => visit.restaurantId)
            .filter(Boolean)
        : sourceLinks
            .filter((link) => link.sourceId === topic.targetId)
            .map((link) => link.restaurantId)
            .filter(Boolean);
    const topicRestaurantCount = new Set(topicRestaurantIds).size;

    await writeRouteHtml(
      path.join("explore", "topic", topic.slug),
      renderHtml(template, {
        title: topicTitle,
        description: topicDescription,
        url: absoluteUrl(siteUrl, topicPath),
        image: defaultImage,
        type: "website",
        adsenseClient,
        staticContent: {
          eyebrow: "Matpick Topic",
          paragraphs: [
            `${topic.name} 출처와 연결된 식당 ${topicRestaurantCount.toLocaleString(
              "ko-KR"
            )}곳을 한 목록으로 정리했습니다. 지점이 다른 동일 상호는 주소를 기준으로 구분하고, 확인된 대표 메뉴와 지역 정보로 비교할 수 있습니다.`,
            "식당 정보는 기준 시점 이후 변경될 수 있으므로 방문 전 최신 영업 상태와 메뉴를 다시 확인해 주세요.",
          ],
          links: restaurantLinks(topicRestaurantIds),
        },
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: topicTitle,
          description: topicDescription,
          url: absoluteUrl(siteUrl, topicPath),
        },
      })
    );
  }

  for (const episode of topicEpisodes) {
    const episodePath = `/explore/topic/${episode.topicSlug}/episode/${episode.slug}`;
    const episodeTitle = `${episode.topicName} ${episode.episode} 맛집 탐색`;

    await writeRouteHtml(
      path.join("explore", "topic", episode.topicSlug, "episode", episode.slug),
      renderHtml(template, {
        title: episodeTitle,
        description: episode.description,
        url: absoluteUrl(siteUrl, episodePath),
        image: defaultImage,
        type: "website",
        adsenseClient,
        staticContent: {
          eyebrow: "Episode Restaurants",
          paragraphs: [
            `${episode.title}에서 소개된 식당 ${episode.restaurantIds.length.toLocaleString(
              "ko-KR"
            )}곳을 회차 맥락과 함께 정리했습니다. 각 식당 상세 페이지에서 주소, 대표 메뉴와 지도 이동 경로를 확인할 수 있습니다.`,
          ],
          links: restaurantLinks(episode.restaurantIds),
        },
        jsonLd: {
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: episodeTitle,
          description: episode.description,
          url: absoluteUrl(siteUrl, episodePath),
        },
      })
    );
  }

  await writeRouteHtml(
    "map",
    renderHtml(template, {
      title: "맛집 지도 | 내 주변과 추천 맛집 보기",
      description:
        "추천 맛집을 지도에서 확인하고 현재 위치를 기준으로 가까운 식당을 비교할 수 있는 Matpick 지도 페이지.",
      url: absoluteUrl(siteUrl, "/map"),
      image: defaultImage,
      type: "website",
      adsenseClient,
      staticContent: {
        eyebrow: "Map Discovery",
        paragraphs: [
          "지도 페이지는 식당 좌표를 현재 화면 범위에 맞춰 표시하고, 가까운 지점이나 선택한 주제의 식당을 비교할 수 있게 구성합니다. 현재 위치는 브라우저에서 직접 허용한 경우에만 거리 계산에 사용합니다.",
        ],
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Map",
        name: "맛집 지도",
        url: absoluteUrl(siteUrl, "/map"),
      },
    })
  );

  await writeRouteHtml(
    "about",
    renderHtml(template, {
      title: "Matpick 서비스 소개 | 데이터 출처와 운영 기준",
      description:
        "Matpick이 어떤 방식으로 맛집 데이터를 수집, 정리, 보강하는지와 서비스 운영 기준을 소개합니다.",
      url: absoluteUrl(siteUrl, "/about"),
      image: defaultImage,
      type: "website",
      adsenseClient,
      staticContent: {
        eyebrow: "Editorial Standards",
        paragraphs: [
          "Matpick은 공개된 방송·가이드·크리에이터 목록을 바탕으로 지점을 구분하고 주소, 카테고리, 대표 메뉴와 좌표를 구조화합니다. 출처와 회차는 보존하며 확인된 폐업 정보도 기록으로 남깁니다.",
          "식당 카드 이미지는 자체 편집 자료이고 일부는 생성형 이미지 도구의 도움을 받아 제작될 수 있습니다. 실제 매장 촬영 사진이나 방송 원본 화면을 의미하지 않습니다.",
        ],
        links: [{ href: "/contact", label: "정보 정정 및 권리 문의" }],
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "Matpick 서비스 소개",
        url: absoluteUrl(siteUrl, "/about"),
      },
    })
  );

  await writeRouteHtml(
    "privacy",
    renderHtml(template, {
      title: "개인정보처리방침 | Matpick",
      description:
        "Matpick의 개인정보 처리, 브라우저 저장소 사용, 위치 정보 처리와 광고 관련 정책을 안내합니다.",
      url: absoluteUrl(siteUrl, "/privacy"),
      image: defaultImage,
      type: "website",
      adsenseClient,
      staticContent: {
        eyebrow: "Privacy Policy",
        paragraphs: [
          "회원 식별정보와 리뷰는 요청된 기능 제공을 위해 처리하며, 일자별 이용 통계는 45일, 일자별 회원 운영 통계는 180일 보관합니다. 현재 위치는 브라우저 권한이 있을 때 주변 정렬에 사용하고 좌표 자체를 회원 프로필에 저장하지 않는 것이 원칙입니다.",
          "선택형 분석·광고 도구는 이용자가 허용한 경우에만 사이트 코드에서 실행되며 언제든 개인정보 설정에서 변경할 수 있습니다.",
        ],
        links: [{ href: "/contact", label: "개인정보 권리 요청" }],
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Matpick 개인정보처리방침",
        url: absoluteUrl(siteUrl, "/privacy"),
      },
    })
  );

  await writeRouteHtml(
    "terms",
    renderHtml(template, {
      title: "이용약관 | Matpick",
      description: "Matpick 서비스 이용 조건, 광고 및 외부 링크 정책, 면책과 운영 원칙을 안내합니다.",
      url: absoluteUrl(siteUrl, "/terms"),
      image: defaultImage,
      type: "website",
      adsenseClient,
      staticContent: {
        eyebrow: "Terms of Service",
        paragraphs: [
          "Matpick은 식당 정보 탐색 서비스이며 예약·주문·결제를 직접 제공하지 않습니다. 이용자 콘텐츠는 적법한 권리를 가진 자료만 올릴 수 있고, 카드 이미지와 편집 데이터의 무단 복제·재배포·대량 수집은 금지됩니다.",
          "광고와 제휴 링크는 편집 콘텐츠와 구분하며 식당 정보는 방문 전에 최신 상태를 다시 확인해야 합니다.",
        ],
        links: [{ href: "/contact", label: "약관 및 권리 문의" }],
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "WebPage",
        name: "Matpick 이용약관",
        url: absoluteUrl(siteUrl, "/terms"),
      },
    })
  );

  await writeRouteHtml(
    "contact",
    renderHtml(template, {
      title: "문의 안내 | Matpick",
      description:
        "데이터 수정 요청, 서비스 개선 제안, 운영 문의를 위한 Matpick 문의 안내 페이지입니다.",
      url: absoluteUrl(siteUrl, "/contact"),
      image: defaultImage,
      type: "website",
      adsenseClient,
      staticContent: {
        eyebrow: "Support and Corrections",
        paragraphs: [
          "식당 정보 정정, 개인정보 권리 행사, 계정 삭제, 저작권·초상권 관련 삭제 요청은 Instagram @matpick.co.kr DM으로 접수합니다. 개인정보와 신원 자료는 공개 GitHub 이슈에 작성하지 마세요.",
        ],
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Matpick 문의 안내",
        url: absoluteUrl(siteUrl, "/contact"),
      },
    })
  );

  await writeRouteHtml(
    "reviews",
    renderHtml(template, {
      title: "방문자 리뷰 모아보기 | Matpick",
      description:
        "맛픽 사용자들이 직접 남긴 최신 리뷰와 사진을 한 화면에서 모아보고, 마음에 드는 식당으로 바로 이동해보세요.",
      url: absoluteUrl(siteUrl, "/reviews"),
      image: defaultImage,
      type: "website",
      adsenseClient,
      staticContent: {
        eyebrow: "Visitor Reviews",
        paragraphs: [
          "이용자가 직접 작성한 최신 리뷰를 식당 정보와 함께 확인할 수 있습니다. 리뷰와 사진은 작성자가 적법한 권리를 가진 자료여야 하며, 권리 침해 신고는 문의 페이지에서 접수합니다.",
        ],
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "Matpick 방문자 리뷰 모아보기",
        url: absoluteUrl(siteUrl, "/reviews"),
      },
    })
  );

  for (const creator of creators) {
    const creatorUrl = absoluteUrl(siteUrl, `/creator/${creator.id}`);
    const creatorImage = creator.profileImage ? absoluteUrl(siteUrl, creator.profileImage) : defaultImage;
    const creatorRestaurantIds = visibleVisits
      .filter((visit) => visit.creatorId === creator.id)
      .map((visit) => visit.restaurantId)
      .filter(Boolean);
    const creatorHtml = renderHtml(template, {
      title: `${creator.name} 추천 맛집 | Matpick`,
      description: `${creator.name}이(가) 소개한 맛집과 채널 정보를 Matpick에서 확인해보세요.`,
      url: creatorUrl,
      image: creatorImage,
      type: "profile",
      adsenseClient,
      staticContent: {
        eyebrow: "Creator Restaurant Guide",
        paragraphs: [
          `${creator.name}의 공개 콘텐츠에 소개된 식당 ${new Set(
            creatorRestaurantIds
          ).size.toLocaleString("ko-KR")}곳을 출처와 함께 정리했습니다. 같은 식당이 여러 영상에 등장한 경우 식당 정보는 하나로 연결하고 소개 기록은 유지합니다.`,
        ],
        links: restaurantLinks(creatorRestaurantIds),
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Person",
        name: creator.name,
        image: creatorImage,
        url: creatorUrl,
        sameAs: creator.youtubeUrl ? [creator.youtubeUrl] : undefined,
      },
    });

    await writeRouteHtml(path.join("creator", creator.id), creatorHtml);
  }

  for (const restaurant of restaurants) {
    const restaurantUrl = absoluteUrl(siteUrl, `/restaurant/${restaurant.id}`);
    const restaurantImage = restaurant.imageUrl
      ? absoluteUrl(siteUrl, restaurant.imageUrl)
      : defaultImage;
    const restaurantSources = [
      ...visibleVisits
        .filter((visit) => visit.restaurantId === restaurant.id)
        .map((visit) => visit.videoTitle || visit.episode)
        .filter(Boolean),
      ...sourceLinks
        .filter((link) => link.restaurantId === restaurant.id)
        .map((link) => link.sourceName || link.sourceId)
        .filter(Boolean),
    ];
    const restaurantFacts = [
      restaurant.address ? `주소: ${restaurant.address}` : "",
      restaurant.region ? `지역: ${restaurant.region}` : "",
      restaurant.category ? `음식 종류: ${restaurant.category}` : "",
      restaurant.representativeMenu
        ? `대표 메뉴: ${restaurant.representativeMenu}`
        : "",
      restaurant.status ? `영업 상태: ${restaurant.status}` : "",
      restaurantSources.length > 0
        ? `소개 출처: ${Array.from(new Set(restaurantSources)).slice(0, 4).join(", ")}`
        : "",
    ].filter(Boolean);
    const restaurantHtml = renderHtml(template, {
      title: `${restaurant.name} 맛집 정보 | Matpick`,
      description: `${restaurant.name}의 위치, 대표 메뉴, 추천 소스 정보를 Matpick에서 확인해보세요.`,
      url: restaurantUrl,
      image: restaurantImage,
      type: "article",
      adsenseClient,
      staticContent: {
        eyebrow: "Restaurant Detail",
        paragraphs: [
          `${restaurant.name}은(는) Matpick의 방송·크리에이터·가이드 출처 데이터와 연결된 식당입니다. 아래 정보는 서로 다른 출처의 표기를 한 식당 기준으로 정리한 것이며, 방문 전에 최신 영업 상태와 가격을 확인하는 것이 좋습니다.`,
        ],
        facts: restaurantFacts,
        links:
          restaurantSources.length > 0
            ? [{ href: "/explore", label: "관련 출처에서 다른 식당 보기" }]
            : [],
      },
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        name: restaurant.name,
        image: restaurantImage,
        servesCuisine: restaurant.category || undefined,
        url: restaurantUrl,
        address: restaurant.address
          ? {
              "@type": "PostalAddress",
              streetAddress: restaurant.address,
              addressCountry: "KR",
            }
          : undefined,
        geo:
          restaurant.lat && restaurant.lng
            ? {
                "@type": "GeoCoordinates",
                latitude: restaurant.lat,
                longitude: restaurant.lng,
              }
            : undefined,
      },
    });

    await writeRouteHtml(path.join("restaurant", restaurant.id), restaurantHtml);
  }

  console.log(`Prerendered ${creators.length} creator pages and ${restaurants.length} restaurant pages.`);
}

main().catch((error) => {
  console.error("Failed to prerender SEO pages:", error);
  process.exitCode = 1;
});
