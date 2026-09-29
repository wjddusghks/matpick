const searchAliases = require("../../matpick_all/client/src/data/search-aliases.json");

const INITIALS = [
  "ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ",
  "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",
];
const ONSETS = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss",
  "", "j", "jj", "ch", "k", "t", "p", "h",
];
const VOWELS = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae",
  "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
];
const CODAS = [
  "", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb",
  "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t",
  "k", "t", "p", "h",
];

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFC")
    .toLocaleLowerCase("ko-KR")
    .replace(/\s+/g, "")
    .replace(/[-._,/#!$%^&*;:{}=`~()'"?<>+\[\]\\|·ㆍ]/g, "");
}

function romanizeSearchText(value) {
  let output = "";
  for (const character of String(value || "").normalize("NFKC")) {
    const code = character.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) {
      output += character;
      continue;
    }
    const onset = Math.floor(code / 588);
    const vowel = Math.floor((code % 588) / 28);
    const coda = code % 28;
    output += `${ONSETS[onset]}${VOWELS[vowel]}${CODAS[coda]}`;
  }
  return normalizeSearchText(output);
}

function getHangulInitials(value) {
  let output = "";
  for (const character of String(value || "").normalize("NFKC")) {
    const code = character.charCodeAt(0) - 0xac00;
    output += code >= 0 && code <= 11171 ? INITIALS[Math.floor(code / 588)] : character;
  }
  return normalizeSearchText(output);
}

const normalizedGroups = searchAliases.groups.map((group) =>
  Array.from(new Set(group.map(normalizeSearchText).filter(Boolean))),
);
const groupsByAlias = new Map();
normalizedGroups.forEach((group) => group.forEach((alias) => groupsByAlias.set(alias, group)));
const stopWords = new Set(searchAliases.stopWords.map(normalizeSearchText));

function getSearchVariants(value) {
  const normalized = normalizeSearchText(value);
  const variants = new Set(normalized ? [normalized] : []);
  (groupsByAlias.get(normalized) || []).forEach((alias) => variants.add(alias));
  for (const suffix of ["맛집", "식당", "음식점", "restaurant", "restaurants"]) {
    if (normalized.endsWith(suffix) && normalized.length > suffix.length) {
      const stem = normalized.slice(0, -suffix.length);
      variants.add(stem);
      (groupsByAlias.get(stem) || []).forEach((alias) => variants.add(alias));
    }
  }
  if (normalized.endsWith("역") && normalized.length > 1) variants.add(normalized.slice(0, -1));
  return Array.from(variants).filter(Boolean);
}

function getSearchTerms(query) {
  const trimmed = String(query || "").trim();
  const whole = normalizeSearchText(trimmed);
  const wholeAliases = groupsByAlias.get(whole);
  if (wholeAliases && /\s/.test(trimmed)) return [wholeAliases];
  const words = trimmed.split(/\s+/).filter(Boolean).slice(0, 12);
  const rawTerms = [];
  for (let index = 0; index < words.length;) {
    let size = Math.min(5, words.length - index);
    while (size > 1 && !groupsByAlias.has(normalizeSearchText(words.slice(index, index + size).join(' ')))) size--;
    const term = words.slice(index, index + size).join(' ');
    if (!stopWords.has(normalizeSearchText(term))) rawTerms.push(term);
    index += size;
  }
  return (rawTerms.length ? rawTerms : [trimmed])
    .map(getSearchVariants)
    .filter((variants) => variants.length);
}

function withinOneEdit(left, right) {
  if (Math.abs(left.length - right.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) {
      i += 1;
      j += 1;
      continue;
    }
    edits += 1;
    if (edits > 1) return false;
    if (left.length > right.length) i += 1;
    else if (right.length > left.length) j += 1;
    else {
      i += 1;
      j += 1;
    }
  }
  return edits + Number(i < left.length || j < right.length) <= 1;
}

function fuzzyContains(value, needle) {
  if (needle.length < 3 || (/^[a-z]+$/.test(needle) && needle.length < 4) || value.length > 180) return false;
  for (let size = Math.max(2, needle.length - 1); size <= Math.min(value.length, needle.length + 1); size += 1) {
    for (let index = 0; index <= value.length - size; index += 1) {
      if (withinOneEdit(value.slice(index, index + size), needle)) return true;
    }
  }
  return false;
}

function matchSearchField(value, variants, allowFuzzy = true) {
  const normalized = normalizeSearchText(value);
  if (!normalized) return null;
  const romanized = romanizeSearchText(value);
  const initials = getHangulInitials(value);
  let best = null;
  for (const variant of variants) {
    let candidate = null;
    if (normalized === variant) candidate = { score: 32, kind: "exact" };
    else if (normalized.startsWith(variant)) candidate = { score: 24, kind: "prefix" };
    else if (normalized.includes(variant)) candidate = { score: 18, kind: "contains" };
    else if (/^[a-z0-9]{3,}$/.test(variant) && romanized.includes(variant)) candidate = { score: 15, kind: "romanized" };
    else if (/^[ㄱ-ㅎ]{2,}$/.test(variant) && initials.includes(variant)) candidate = { score: 13, kind: "initials" };
    else if (allowFuzzy && fuzzyContains(normalized, variant)) candidate = { score: 7, kind: "typo" };
    if (candidate && (!best || candidate.score > best.score)) best = candidate;
  }
  return best;
}

function matchFields(query, fields, allowFuzzy = true) {
  const terms = getSearchTerms(query);
  if (!terms.length) return null;
  const matches = [];
  let score = 0;
  for (const variants of terms) {
    let best = null;
    for (const field of fields) {
      const match = matchSearchField(field.value, variants, allowFuzzy);
      if (!match) continue;
      const weighted = field.weight + match.score;
      if (!best || weighted > best.score) best = { ...field, ...match, score: weighted };
    }
    if (!best) return null;
    matches.push(best);
    score += best.score;
  }
  return { score, matches };
}

function searchRestaurants(query, restaurants, getSources, allowFuzzy = false) {
  const results = restaurants.map((restaurant) => {
    const menus = Array.from(new Set([
      restaurant.representativeMenu,
      ...(restaurant.menus || []).map((menu) => menu.name),
    ].map((value) => String(value || "").trim()).filter(Boolean)));
    const sources = getSources(restaurant.id);
    const fields = [
      { type: "name", value: restaurant.name, weight: 120 },
      ...menus.map((value) => ({ type: "menu", value, weight: 98 })),
      { type: "category", value: restaurant.category, weight: 84 },
      { type: "location", value: restaurant.region, weight: 78 },
      { type: "location", value: restaurant.address, weight: 74 },
      ...sources.flatMap((source) => [
        { type: "source", value: source.name, weight: 62 },
        { type: "source", value: source.description, weight: 50 },
        { type: "source", value: source.provider, weight: 46 },
        { type: "source", value: source.type, weight: 42 },
      ]),
    ];
    const result = matchFields(query, fields, allowFuzzy);
    if (!result) return null;
    const matchedMenus = result.matches.filter((match) => match.type === "menu")
      .map((match) => match.value).filter(Boolean).slice(0, 3);
    const types = new Set(result.matches.map((match) => match.type));
    const primary = result.matches[0];
    const typo = result.matches.some((match) => match.kind === "typo");
    const matchLabel = typo ? "유사 검색어" : matchedMenus.length ? "메뉴 일치"
      : types.has("location") ? "지역 일치"
      : types.has("category") ? "카테고리 일치"
      : types.has("source") ? "방송·출처 일치" : "식당명 일치";
    const matchedText = matchedMenus.length ? matchedMenus.join(" · ")
      : types.has("location") ? restaurant.address || restaurant.region
      : types.has("category") ? restaurant.category
      : types.has("source") ? primary.value
      : restaurant.address || restaurant.region;
    return { restaurant, score: result.score, matchLabel, matchedText };
  }).filter(Boolean).sort((left, right) =>
    right.score - left.score || String(left.restaurant.name).localeCompare(String(right.restaurant.name), "ko-KR"),
  );
  return !results.length && !allowFuzzy ? searchRestaurants(query, restaurants, getSources, true) : results;
}

module.exports = {
  getSearchTerms,
  getSearchVariants,
  matchFields,
  matchSearchField,
  normalizeSearchText,
  romanizeSearchText,
  searchRestaurants,
};
