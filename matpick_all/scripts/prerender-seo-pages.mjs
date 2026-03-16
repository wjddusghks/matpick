import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const distDir = path.join(projectRoot, "dist");
const baseDataPath = path.join(projectRoot, "client", "src", "data", "matpick-data.json");
const oldKoreanPath = path.join(
  projectRoot,
  "client",
  "src",
  "data",
  "generated",
  "old-korean-100.generated.json"
);

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

    const scriptTag =
      `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${escapeHtml(
        metadata.adsenseClient
      )}" crossorigin="anonymous"></script>`;

    html = html.replace(
      /<script\s+async\s+src="https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=.*?"\s+crossorigin="anonymous"><\/script>\s*/i,
      ""
    );
    html = html.replace("</head>", `  ${scriptTag}\n  </head>`);
  }

  html = html.replace(
    /<script type="application\/ld\+json">.*?<\/script>/gs,
    ""
  );

  if (metadata.jsonLd) {
    html = injectJsonLd(html, metadata.jsonLd);
  }

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
  const oldKoreanData = await readJson(oldKoreanPath);
  const { creators, restaurants } = mergeDatasets(baseData, [oldKoreanData]);
  const defaultImage = absoluteUrl(siteUrl, "/og-default.png");
  const adsenseClient = process.env.VITE_ADSENSE_CLIENT?.trim() || "";

  const homeHtml = renderHtml(template, {
    title: "맛픽 Matpick | 크리에이터 추천 맛집 지도",
    description:
      "유튜브, 방송, 가이드에 소개된 맛집을 한곳에서 찾고 지도와 상세 정보로 비교해보는 맛집 탐색 서비스.",
    url: absoluteUrl(siteUrl, "/"),
    image: defaultImage,
    type: "website",
    adsenseClient,
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
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "CollectionPage",
        name: "맛집 탐색",
        url: absoluteUrl(siteUrl, "/explore"),
      },
    })
  );

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
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "ContactPage",
        name: "Matpick 문의 안내",
        url: absoluteUrl(siteUrl, "/contact"),
      },
    })
  );

  for (const creator of creators) {
    const creatorUrl = absoluteUrl(siteUrl, `/creator/${creator.id}`);
    const creatorImage = creator.profileImage ? absoluteUrl(siteUrl, creator.profileImage) : defaultImage;
    const creatorHtml = renderHtml(template, {
      title: `${creator.name} 추천 맛집 | Matpick`,
      description: `${creator.name}이(가) 소개한 맛집과 채널 정보를 Matpick에서 확인해보세요.`,
      url: creatorUrl,
      image: creatorImage,
      type: "profile",
      adsenseClient,
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
    const restaurantHtml = renderHtml(template, {
      title: `${restaurant.name} 맛집 정보 | Matpick`,
      description: `${restaurant.name}의 위치, 대표 메뉴, 추천 소스 정보를 Matpick에서 확인해보세요.`,
      url: restaurantUrl,
      image: restaurantImage,
      type: "article",
      adsenseClient,
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
