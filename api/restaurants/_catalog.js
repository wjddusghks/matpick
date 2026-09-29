const dataset = require("../../matpick_all/client/src/data/generated/public-dataset.json");
const discoveryTopics = require("../../matpick_all/client/src/data/discovery-topics.json");
const {
  matchFields,
  normalizeSearchText,
  searchRestaurants,
} = require("./_search");

const MAX_PAGE_SIZE = 24;
const MAX_RESULT_OFFSET = dataset.restaurants.length;
const communitySource = { id: "community-picks", name: "추천식당", type: "other", provider: "맛픽", description: "사용자가 제보하고 운영자가 승인한 식당 · Community Picks", imageUrl: "/source-covers/community-picks.svg" };
const allSources = [...(dataset.sources || []), communitySource];
const sourceById = new Map(allSources.map((source) => [source.id, source]));
const publicCreators = Array.from(new Map([
  ...(dataset.sources || [])
    .filter((source) => source.creatorId)
    .map((source) => [source.creatorId, {
      id: source.creatorId,
      name: source.name,
      channelName: source.name,
      profileImage: source.imageUrl || "",
      subscribers: "",
      description: source.description || "",
      youtubeUrl: `https://www.youtube.com/channel/${source.creatorId}`,
      series: source.name,
    }]),
  ...(dataset.creators || []).map((creator) => [creator.id, creator]),
]).values());
const linksByRestaurant = new Map();
const restaurantIdsBySource = new Map();

for (const link of dataset.sourceLinks || []) {
  const links = linksByRestaurant.get(link.restaurantId) || [];
  links.push(link);
  linksByRestaurant.set(link.restaurantId, links);
  const ids = restaurantIdsBySource.get(link.sourceId) || new Set();
  ids.add(link.restaurantId);
  restaurantIdsBySource.set(link.sourceId, ids);
}

function applyEdits(restaurants, edits = []) {
  const editsById = new Map(edits.map((edit) => [edit.restaurantId, edit]));
  return restaurants
    .filter((restaurant) => !editsById.get(restaurant.id)?.deletedAt)
    .map((restaurant) => ({
      ...restaurant,
      ...(editsById.get(restaurant.id)?.changes || {}),
    }));
}

function addMenuIds(restaurant) {
  if (!Array.isArray(restaurant.menus)) return restaurant;
  return {
    ...restaurant,
    menus: restaurant.menus.map((menu, index) => ({
      ...menu,
      id: menu.id || `m${index.toString(36)}`,
    })),
  };
}

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "")
    .replace(/[-._,/#!$%^&*;:{}=`~()'"?<>+\[\]\\|·ㆍ]/g, "");
}

function slugifyEpisode(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "") || "episode";
}

function getSourceEpisodeGroups(sourceId, sourceLinks = dataset.sourceLinks || []) {
  const grouped = new Map();
  for (const link of sourceLinks) {
    if (link.sourceId !== sourceId) continue;
    const label = String(link.label || (Number.isFinite(link.ordinal) ? `EP.${link.ordinal}` : "")).trim();
    if (!label) continue;
    const current = grouped.get(label) || [];
    current.push(link);
    grouped.set(label, current);
  }
  const used = new Set();
  return Array.from(grouped, ([label, links]) => {
    const base = slugifyEpisode(label);
    const slug = used.has(base) ? `${base}-${links[0]?.ordinal || used.size + 1}` : base;
    used.add(slug);
    return { slug, label, links };
  });
}

function broadRegion(value) {
  const text = String(value || "").trim();
  const aliases = {
    서울특별시: "서울", 부산광역시: "부산", 대구광역시: "대구",
    인천광역시: "인천", 광주광역시: "광주", 대전광역시: "대전",
    울산광역시: "울산", 세종특별자치시: "세종", 경기도: "경기",
    강원특별자치도: "강원", 충청북도: "충북", 충청남도: "충남",
    전북특별자치도: "전북", 전라북도: "전북", 전라남도: "전남",
    경상북도: "경북", 경상남도: "경남", 제주특별자치도: "제주",
  };
  const key = Object.keys(aliases).find((candidate) => text.startsWith(candidate));
  if (key) return aliases[key];
  return text.split(/[\s,/]/)[0] || text;
}

function distanceKm(lat, lng, restaurant) {
  if (![lat, lng, restaurant.lat, restaurant.lng].every(Number.isFinite)) return Infinity;
  const radians = (value) => (value * Math.PI) / 180;
  const deltaLat = radians(restaurant.lat - lat);
  const deltaLng = radians(restaurant.lng - lng);
  const a = Math.sin(deltaLat / 2) ** 2 +
    Math.cos(radians(lat)) * Math.cos(radians(restaurant.lat)) * Math.sin(deltaLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isAvailable(restaurant) {
  return !restaurant.recommendationHold &&
    !["closed", "moved", "temporarily_closed"].includes(restaurant.operationState) &&
    !/폐업|이전|휴업|permanently\s*closed|temporarily\s*closed|relocated/i.test(restaurant.operationStatus || "");
}

function sourceLabels(restaurantId, linkIndex = linksByRestaurant) {
  return (linkIndex.get(restaurantId) || [])
    .map((link) => sourceById.get(link.sourceId)?.name)
    .filter(Boolean)
    .slice(0, 4);
}

function toSummary(restaurant, linkIndex = linksByRestaurant) {
  const menus = (restaurant.menus || []).slice(0, 3).map((menu, index) => ({
    id: menu.id || `m${index.toString(36)}`,
    name: menu.name,
    price: menu.price,
    isSignature: menu.isSignature === true,
  }));
  return {
    id: restaurant.id,
    name: restaurant.name,
    region: restaurant.region,
    address: restaurant.address,
    category: restaurant.category,
    lat: restaurant.lat,
    lng: restaurant.lng,
    imageUrl: restaurant.imageUrl,
    thumbnailFileName: restaurant.thumbnailFileName,
    representativeMenu: restaurant.representativeMenu,
    menus,
    foundingYear: restaurant.foundingYear,
    operationState: restaurant.operationState,
    operationStatus: restaurant.operationStatus,
    isOverseas: restaurant.isOverseas === true,
    sourceLabels: sourceLabels(restaurant.id, linkIndex),
  };
}

function resolveId(id, restaurantsById) {
  let current = String(id || "").trim();
  const seen = new Set();
  while (dataset.restaurantAliases?.[current] && !seen.has(current)) {
    seen.add(current);
    current = dataset.restaurantAliases[current];
  }
  return restaurantsById.has(current) ? current : "";
}

function parseLimit(value) {
  const parsed = Number.parseInt(String(value || "12"), 10);
  return Number.isFinite(parsed) ? Math.min(MAX_PAGE_SIZE, Math.max(1, parsed)) : 12;
}

function parseCursor(value) {
  if (!value) return 0;
  try {
    const decoded = Buffer.from(String(value), "base64url").toString("utf8");
    const offset = Number.parseInt(decoded, 10);
    return Number.isSafeInteger(offset) && offset >= 0 && offset <= MAX_RESULT_OFFSET
      ? offset
      : null;
  } catch {
    return null;
  }
}

function encodeCursor(offset) {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

function queryCatalog(query, edits = [], publications = []) {
  const restaurants = applyEdits([...dataset.restaurants, ...publications.map(p => p.restaurant)], edits).filter(isAvailable);
  const restaurantsById = new Map(restaurants.map((restaurant) => [restaurant.id, restaurant]));
  const linkOverrides = new Map(
    edits
      .filter((edit) => Array.isArray(edit?.changes?.sourceLinks))
      .map((edit) => [edit.restaurantId, edit.changes.sourceLinks]),
  );
  const effectiveSourceLinks = [
    ...(dataset.sourceLinks || []).filter(
      (link) => !linkOverrides.has(link.restaurantId),
    ),
    ...Array.from(linkOverrides.values()).flat(),
    ...publications.filter(p => !linkOverrides.has(p.restaurant.id)).map(p => p.sourceLink),
  ];
  const currentLinksByRestaurant = new Map();
  const currentRestaurantIdsBySource = new Map();
  for (const link of effectiveSourceLinks) {
    const links = currentLinksByRestaurant.get(link.restaurantId) || [];
    links.push(link);
    currentLinksByRestaurant.set(link.restaurantId, links);
    const ids = currentRestaurantIdsBySource.get(link.sourceId) || new Set();
    ids.add(link.restaurantId);
    currentRestaurantIdsBySource.set(link.sourceId, ids);
  }
  const availableRestaurantIdsBySource = new Map();
  for (const link of effectiveSourceLinks) {
    if (restaurantsById.has(link.restaurantId)) {
      const ids = availableRestaurantIdsBySource.get(link.sourceId) || new Set();
      ids.add(link.restaurantId);
      availableRestaurantIdsBySource.set(link.sourceId, ids);
    }
  }
  const publicSources = allSources.map((source) => ({
    ...source,
    restaurantCount: availableRestaurantIdsBySource.get(source.id)?.size || 0,
  }));
  const view = String(query.view || "list");

  if (view === "detail") {
    const requestedId = String(query.id || "").trim();
    const id = resolveId(requestedId, restaurantsById);
    if (!id) return { status: 404, body: { error: "Restaurant not found" } };
    const restaurant = addMenuIds(restaurantsById.get(id));
    const sourceLinks = currentLinksByRestaurant.get(id) || [];
    const sources = sourceLinks.map((link) => sourceById.get(link.sourceId)).filter(Boolean);
    return {
      status: 200,
      body: {
        creators: publicCreators,
        restaurant,
        sourceLinks,
        sources,
        canonicalId: id,
        restaurantAliases: requestedId !== id ? { [requestedId]: id } : {},
      },
    };
  }

  if (view === "metadata") {
    return { status: 200, body: { creators: publicCreators, sources: publicSources, discoveryTopics } };
  }

  if (view !== "list") {
    return { status: 400, body: { error: "Unsupported catalog view" } };
  }

  const limit = parseLimit(query.limit);
  const offset = parseCursor(query.cursor);
  if (offset == null) return { status: 400, body: { error: "Invalid cursor" } };
  const type = String(query.type || "search");
  const value = String(query.value || "").trim();
  let results = [];
  let topicEpisodeGroups = [];
  let searchSuggestions = [];
  let searchDetailsById = new Map();

  if (type === "ids") {
    const ids = String(query.ids || "").split(",").map((id) => id.trim()).filter(Boolean);
    if (!ids.length || ids.length > MAX_PAGE_SIZE) {
      return { status: 400, body: { error: `ids must contain 1-${MAX_PAGE_SIZE} values` } };
    }
    results = ids.map((id) => restaurantsById.get(resolveId(id, restaurantsById))).filter(Boolean);
  } else if (type === "search") {
    const rawQuery = String(query.q || "").trim();
    const q = normalizeSearchText(rawQuery);
    if (!q || q.length > 80 || (/^[a-z0-9]+$/i.test(q) && q.length < 3)) {
      return { status: 400, body: { error: "Enter a specific search term" } };
    }
    const rankedMatches = searchRestaurants(rawQuery, restaurants, (restaurantId) => {
      const links = currentLinksByRestaurant.get(restaurantId) || [];
      return links.map((link) => sourceById.get(link.sourceId)).filter(Boolean);
    });
    results = rankedMatches.map((match) => match.restaurant);
    searchDetailsById = new Map(rankedMatches.map((match) => [match.restaurant.id, match]));

    const countAndRank = (values, type, weight) => {
      const counts = new Map();
      for (const value of values.filter(Boolean)) counts.set(value, (counts.get(value) || 0) + 1);
      return Array.from(counts, ([name, restaurantCount]) => ({
        name,
        restaurantCount,
        match: matchFields(rawQuery, [{ type, value: name, weight }]),
      })).filter((entry) => entry.match)
        .sort((left, right) => right.match.score - left.match.score || right.restaurantCount - left.restaurantCount);
    };
    const regionMatches = countAndRank(restaurants.map((restaurant) => restaurant.region), "location", 78)
      .slice(0, 3).map((entry) => ({
        id: `region:${normalizeSearchText(entry.name)}`,
        type: "region",
        name: entry.name,
        parentRegion: broadRegion(entry.name),
        restaurantCount: entry.restaurantCount,
      }));
    const foodMatches = countAndRank(restaurants.map((restaurant) => restaurant.category), "category", 84)
      .slice(0, 3).map((entry) => ({
        id: `food:${normalizeSearchText(entry.name)}`,
        type: "food",
        name: entry.name,
        restaurantCount: entry.restaurantCount,
      }));
    const sourceMatches = publicSources.map((source) => ({
      source,
      match: matchFields(rawQuery, [
        { type: "source", value: source.name, weight: 70 },
        { type: "source", value: source.description, weight: 58 },
        { type: "source", value: source.provider, weight: 52 },
        { type: "source", value: source.type, weight: 48 },
      ]),
    })).filter((entry) => entry.match && entry.source.restaurantCount > 0)
      .sort((left, right) => right.match.score - left.match.score || right.source.restaurantCount - left.source.restaurantCount)
      .slice(0, 3).map(({ source }) => ({
        id: source.id,
        type: "source",
        name: source.name,
        image: source.imageUrl,
        restaurantCount: source.restaurantCount,
        sourceTypeLabel: source.type,
      }));
    const restaurantMatches = rankedMatches.slice(0, 14).map((match) => ({
      id: match.restaurant.id,
      type: "restaurant",
      name: match.restaurant.name,
      category: match.restaurant.category,
      address: match.restaurant.address,
      matchLabel: match.matchLabel,
      matchedText: match.matchedText,
    }));
    searchSuggestions = [{
      id: `query:${q}`,
      type: "query",
      name: rawQuery,
      restaurantCount: rankedMatches.length,
      matchLabel: "통합 검색",
      matchedText: `식당명·메뉴·지역·출처에서 ${rankedMatches.length.toLocaleString()}곳`,
    }, ...regionMatches, ...foodMatches, ...sourceMatches, ...restaurantMatches].slice(0, 24);
  } else if (type === "source") {
    if (!sourceById.has(value)) return { status: 404, body: { error: "Source not found" } };
    const ids = currentRestaurantIdsBySource.get(value) || new Set();
    results = restaurants.filter((restaurant) => ids.has(restaurant.id));
  } else if (type === "region") {
    const target = normalize(value);
    if (!target) return { status: 400, body: { error: "Region is required" } };
    results = restaurants.filter((restaurant) =>
      normalize(broadRegion(restaurant.region)) === target || normalize(restaurant.region).includes(target));
  } else if (type === "category") {
    const target = normalize(value);
    if (!target) return { status: 400, body: { error: "Category is required" } };
    results = restaurants.filter((restaurant) => normalize(restaurant.category).includes(target));
  } else if (type === "nearby") {
    const lat = Number(query.lat);
    const lng = Number(query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
      return { status: 400, body: { error: "Valid coordinates are required" } };
    }
    results = restaurants
      .map((restaurant) => ({ restaurant, distanceKm: distanceKm(lat, lng, restaurant) }))
      .filter((entry) => Number.isFinite(entry.distanceKm))
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .map((entry) => ({ ...entry.restaurant, distanceKm: entry.distanceKm }));
  } else if (type === "creator") {
    if (!value) return { status: 400, body: { error: "Creator is required" } };
    const sourceIds = new Set((dataset.sources || [])
      .filter((source) => source.creatorId === value)
      .map((source) => source.id));
    const ids = new Set(effectiveSourceLinks
      .filter((link) => sourceIds.has(link.sourceId))
      .map((link) => link.restaurantId));
    results = restaurants.filter((restaurant) => ids.has(restaurant.id));
  } else if (type === "topic") {
    const topic = discoveryTopics.find((entry) => entry.slug === value);
    if (!topic) {
      return { status: 404, body: { error: "Topic not found" } };
    }
    if (topic.kind === "creator") {
      const sourceIds = new Set((dataset.sources || [])
        .filter((source) => source.creatorId === topic.targetId)
        .map((source) => source.id));
      const ids = new Set(effectiveSourceLinks
        .filter((link) => sourceIds.has(link.sourceId))
        .map((link) => link.restaurantId));
      results = restaurants.filter((restaurant) => ids.has(restaurant.id));
    } else if (!sourceById.has(topic.targetId)) {
      return { status: 404, body: { error: "Topic source not found" } };
    } else {
    let ids = currentRestaurantIdsBySource.get(topic.targetId) || new Set();
    topicEpisodeGroups = getSourceEpisodeGroups(topic.targetId, effectiveSourceLinks);
    const requestedEpisode = String(query.episode || "").trim();
    if (requestedEpisode) {
      const matched = topicEpisodeGroups.find((group) => group.slug === requestedEpisode)?.links || [];
      ids = new Set(matched.map((link) => link.restaurantId));
    }
    results = restaurants.filter((restaurant) => ids.has(restaurant.id));
    }
  } else if (type === "featured") {
    results = restaurants
      .map((restaurant) => ({
        ...restaurant,
        recommendationCount: (currentLinksByRestaurant.get(restaurant.id) || []).length,
      }))
      .sort((left, right) =>
        right.recommendationCount - left.recommendationCount ||
        String(left.name).localeCompare(String(right.name), "ko-KR"));
  } else {
    return { status: 400, body: { error: "Unsupported catalog filter" } };
  }

  if (type === "nearby") {
    results.sort((left, right) => left.distanceKm - right.distanceKm);
  } else if (!["featured", "ids", "search"].includes(type)) {
    results.sort((left, right) =>
      String(left.name || "").localeCompare(String(right.name || ""), "ko-KR"));
  }
  const page = results.slice(offset, offset + limit);
  const nextOffset = offset + page.length;
  const hasMore = nextOffset < results.length && nextOffset <= MAX_RESULT_OFFSET;
  const pageIds = new Set(page.map((restaurant) => restaurant.id));
  return {
    status: 200,
    body: {
      restaurants: page.map((restaurant) => ({
        ...toSummary(restaurant, currentLinksByRestaurant),
        ...(searchDetailsById.has(restaurant.id) ? {
          matchLabel: searchDetailsById.get(restaurant.id).matchLabel,
          matchedText: searchDetailsById.get(restaurant.id).matchedText,
        } : {}),
        ...(Number.isFinite(restaurant.distanceKm) ? { distanceKm: restaurant.distanceKm } : {}),
      })),
      ...(type === "search" ? { suggestions: searchSuggestions } : {}),
      nextCursor: hasMore ? encodeCursor(nextOffset) : null,
      hasMore,
      totalCount: results.length,
      topicEpisodes: topicEpisodeGroups.map((group) => ({
        slug: group.slug,
        topicSlug: value,
        episode: group.label,
        title: `${sourceById.get(discoveryTopics.find((topic) => topic.slug === value)?.targetId)?.name || value} ${group.label}`,
        description: `${group.label}에 소개된 맛집 ${new Set(group.links.map((link) => link.restaurantId).filter((id) => restaurantsById.has(id))).size}곳을 모아봤어요.`,
        videoTitle: `${sourceById.get(discoveryTopics.find((topic) => topic.slug === value)?.targetId)?.name || value} ${group.label}`,
        videoUrl: "",
        restaurantIds: Array.from(new Set(group.links
          .map((link) => link.restaurantId)
          .filter((restaurantId) => pageIds.has(restaurantId)))),
        count: new Set(group.links.map((link) => link.restaurantId).filter((id) => restaurantsById.has(id))).size,
        path: `/explore/topic/${encodeURIComponent(value)}/episode/${encodeURIComponent(group.slug)}`,
      })),
      creators: publicCreators,
      sources: publicSources,
      sourceLinks: effectiveSourceLinks.filter((link) => pageIds.has(link.restaurantId)),
      restaurantAliases: Object.fromEntries(
        Object.entries(dataset.restaurantAliases || {}).filter(([, target]) => pageIds.has(target)),
      ),
    },
  };
}

module.exports = {
  MAX_PAGE_SIZE,
  MAX_RESULT_OFFSET,
  applyEdits,
  queryCatalog,
  toSummary,
};
