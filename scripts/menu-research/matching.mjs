const aliases = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원도: "강원",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전라북도: "전북",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};
export const normalize = (value) =>
  String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
export function cleanRestaurantName(restaurant) {
  const parts = String(restaurant.name || "")
    .trim()
    .split(/\s+/);
  const address = String(restaurant.address || "");
  const first = parts[0];
  const locationTokens = address
    .split(/\s+/)
    .slice(0, 3)
    .flatMap((p) => [p, p.replace(/[시군구]$/, ""), aliases[p] || p]);
  if (parts.length > 1 && locationTokens.includes(first)) parts.shift();
  return parts.join(" ");
}
export function addressParts(value) {
  let text = String(value || "")
    .normalize("NFKC")
    .replace(/([가-힣]+)\s+(\d+[가-힣]*(?:로|길))(?=\s+\d)/g, "$1$2");
  const city = /,\s*(Busan|Seoul)\b/i.exec(text)?.[1]?.toLowerCase();
  if (city && !/^(서울(?:특별시)?|부산(?:광역시)?)\s/.test(text))
    text = `${city === "busan" ? "부산" : "서울"} ${text}`;
  const tokens = text.split(/\s+/);
  const province = aliases[tokens[0]] || tokens[0];
  const locality = tokens.slice(1, 3).filter((t) => /[시군구]$/.test(t));
  const road = text
    .replace(/\([^)]*\)/g, "")
    .match(/([가-힣a-zA-Z0-9·.]+(?:대로|로|길))\s+(\d+(?:-\d+)?)/);
  const parcel = text.match(
    /([가-힣0-9]+(?:동\d*가|동|리|읍))\s+(\d+(?:-\d+)?)/,
  );
  return {
    province,
    locality,
    road: road ? `${road[1]} ${road[2]}` : "",
    parcel: parcel ? `${parcel[1]} ${parcel[2]}` : "",
  };
}
export function identityMatch(restaurant, candidate) {
  const left = addressParts(restaurant.address);
  const right = addressParts(candidate.address);
  const sameProvince =
    left.province === right.province ||
    ([left.province, right.province].includes("전남광주통합특별시") &&
      [left.province, right.province].some((p) =>
        ["전남", "광주"].includes(p),
      ));
  const coordinates = [
    restaurant.lat,
    restaurant.lng,
    candidate.lat,
    candidate.lng,
  ].map(Number);
  const [aLat, aLng, bLat, bLng] = coordinates;
  const radians = (n) => (n * Math.PI) / 180;
  const distance = coordinates.every((n) => Number.isFinite(n) && n !== 0)
    ? 6371000 *
      2 *
      Math.asin(
        Math.min(
          1,
          Math.sqrt(
            Math.sin(radians(bLat - aLat) / 2) ** 2 +
              Math.cos(radians(aLat)) *
                Math.cos(radians(bLat)) *
                Math.sin(radians(bLng - aLng) / 2) ** 2,
          ),
        ),
      )
    : Infinity;
  const sameLocality =
    left.locality.some((part) => right.locality.includes(part)) ||
    distance <= 100;
  const sameRoad = Boolean(left.road && left.road === right.road);
  const sameParcel = Boolean(
    left.parcel &&
      left.parcel ===
        addressParts(candidate.parcelAddress || candidate.address).parcel,
  );
  const name = normalize(cleanRestaurantName(restaurant)).replace(
    /현재폐업|폐업/g,
    "",
  );
  const other = normalize(candidate.name);
  const candidateTokens = String(candidate.name || "")
    .split(/\s+/)
    .map(normalize);
  const wholeNameToken = name.length >= 2 && candidateTokens.includes(name);
  const sameName = Boolean(
    name &&
      other &&
      (name === other ||
        wholeNameToken ||
        ((name.includes(other) || other.includes(name)) &&
          Math.min(name.length, other.length) /
            Math.max(name.length, other.length) >=
            0.55)),
  );
  return {
    accepted:
      sameProvince && sameLocality && (sameRoad || sameParcel) && sameName,
    sameName,
    sameProvince,
    sameLocality,
    sameRoad,
    sameParcel,
  };
}
export function normalizeMenus(items, restaurantId) {
  const seen = new Set();
  return items.flatMap((item, index) => {
    const name = String(item.name || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!name || seen.has(normalize(name))) return [];
    seen.add(normalize(name));
    const price = Number(String(item.price ?? "").replace(/,/g, ""));
    return [
      {
        id: `${restaurantId}_researched_${index + 1}`,
        name,
        ...(Number.isFinite(price) && price > 0
          ? { price: `${price.toLocaleString("ko-KR")}원` }
          : {}),
        isSignature: Boolean(item.is_recommend),
        ...(item.updated_at ? { sourceUpdatedAt: item.updated_at } : {}),
      },
    ];
  });
}
