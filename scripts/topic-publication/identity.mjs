// Exact identity checks for adding source associations to an existing restaurant.
// Never treat a shared street prefix or a matching name alone as the same branch.
export const normalizeName = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^가-힣a-z0-9]/g, "");

const provinces = [
  [/서울특별시|서울시|\bSeoul\b/gi, "서울"],
  [/(부산|대구|인천|광주|대전|울산)광역시/g, "$1"],
  [/경기도/g, "경기"],
  [/강원특별자치도|강원도/g, "강원"],
  [/전북특별자치도|전라북도/g, "전북"],
  [/전라남도/g, "전남"],
  [/경상북도/g, "경북"],
  [/경상남도/g, "경남"],
  [/충청북도/g, "충북"],
  [/충청남도/g, "충남"],
  [/제주특별자치도/g, "제주"],
  [/세종특별자치시/g, "세종"],
];

export function addressParts(value) {
  let text = String(value || "").normalize("NFKC");
  for (const [pattern, replacement] of provinces)
    text = text.replace(pattern, replacement);
  // Printed addresses sometimes insert a space inside '로 117번길'.
  text = text.replace(/(로|길)\s+(\d+(?:번|가|나|다)?길)/g, "$1$2");
  const province =
    text.match(
      /서울|부산|대구|인천|광주|대전|울산|경기|강원|전북|전남|경북|경남|충북|충남|제주|세종/,
    )?.[0] || "";
  const areas = [
    ...text.matchAll(/(?:^|[\s,(])([가-힣]+(?:시|군|구))(?=\s|,|\d|$)/g),
  ].map((m) => m[1]);
  const roads = [
    ...text.matchAll(
      /([가-힣a-zA-Z0-9·.]+(?:대로|로|길))\s*(\d+(?:-\d+)?)(?!\d)/g,
    ),
  ].map((m) => `${m[1]}:${m[2]}`);
  const parcels = [
    ...text.matchAll(
      /([가-힣0-9]+(?:동\d*가|로\d+가|동|리))\s*(\d+(?:-\d+)?)(?!\d)/g,
    ),
  ].map((m) => `${m[1]}:${m[2]}`);
  const floors = new Set();
  for (const m of text.matchAll(
    /(지하|지|B)?\s*(\d+(?:\s*[,~\-]\s*\d+)*)\s*층/gi,
  )) {
    let numbers = m[2].match(/\d+/g).map(Number);
    if (
      /[~-]/.test(m[2]) &&
      numbers.length === 2 &&
      numbers[1] >= numbers[0] &&
      numbers[1] - numbers[0] < 50
    )
      numbers = Array.from(
        { length: numbers[1] - numbers[0] + 1 },
        (_, i) => numbers[0] + i,
      );
    numbers.forEach((n) => floors.add(n * (m[1] ? -1 : 1)));
  }
  const units = new Set(
    [...text.matchAll(/(?<!\d)(\d+)\s*호/g)].map((m) => m[1]),
  );
  return { province, areas, roads, parcels, floors, units };
}

const intersects = (left, right) =>
  [...left].some((v) => (right.has ? right.has(v) : right.includes(v)));
export function unitsConflict(a, b) {
  return (
    (a.floors.size && b.floors.size && !intersects(a.floors, b.floors)) ||
    (a.units.size && b.units.size && !intersects(a.units, b.units))
  );
}
export function sameAddress(left, right) {
  const a = addressParts(left),
    b = addressParts(right);
  if (
    !a.province ||
    a.province !== b.province ||
    !a.areas.length ||
    !b.areas.length
  )
    return false;
  if (!intersects(a.areas, b.areas) || unitsConflict(a, b)) return false;
  // Conflicting municipalities or districts are not resolved by a shared province.
  for (const suffix of ["시", "군", "구"]) {
    const aa = a.areas.filter((v) => v.endsWith(suffix)),
      bb = b.areas.filter((v) => v.endsWith(suffix));
    if (aa.length && bb.length && !intersects(aa, bb)) return false;
  }
  return intersects(a.roads, b.roads) || intersects(a.parcels, b.parcels);
}
export function nameKeys(name, address) {
  const parts = addressParts(address);
  const words = String(name || "")
    .trim()
    .split(/\s+/);
  const keys = [normalizeName(name)];
  const places = [
    parts.province,
    ...parts.areas,
    ...parts.areas.map((v) => v.replace(/[시군구]$/, "")),
  ];
  if (words.length > 1 && places.includes(words[0]))
    keys.push(normalizeName(words.slice(1).join(" ")));
  return keys.filter(Boolean);
}
export function sameIdentity(candidate, restaurant, alternativeAddresses = []) {
  if (
    !nameKeys(candidate.name, candidate.address).some((key) =>
      nameKeys(restaurant.name, restaurant.address).includes(key),
    )
  )
    return false;
  if (
    unitsConflict(
      addressParts(candidate.address),
      addressParts(restaurant.address),
    )
  )
    return false;
  return [candidate.address, ...alternativeAddresses].some((address) =>
    sameAddress(address, restaurant.address),
  );
}
export function safeSourceUrl(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : "";
  } catch {
    return "";
  }
}
export function hasPublishableEvidence(e, rank) {
  if (
    e.topicRank !== rank ||
    e.hasCorrectionOrOperationNote ||
    e.nameVerification === "caption_spelling_needs_crosscheck"
  )
    return false;
  const url = safeSourceUrl(e.sourceUrl || e.url);
  if (!url) return false;
  const host = new URL(url).hostname;
  if (rank <= 5 || rank === 9)
    return (
      ["www.youtube.com", "youtube.com"].includes(host) &&
      [
        "official_description",
        "official_video_description",
        "official-detail",
      ].includes(e.sourceKind)
    );
  const hosts = {
    6: "program.kbs.co.kr",
    7: "programs.sbs.co.kr",
    8: "m.imbc.com",
  };
  return (
    host === hosts[rank] &&
    !!(
      e.episodeId ||
      e.sourceKind === "official_broadcast_information" ||
      e.sourceKind === "official-detail"
    )
  );
}
