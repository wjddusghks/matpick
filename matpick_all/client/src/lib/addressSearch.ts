import { ensureNaverMapsSdk } from "./naverMaps";
export type AddressResult = {
  roadAddress: string;
  jibunAddress: string;
  lat?: number;
  lng?: number;
};
export type LocatedAddressResult = AddressResult & { lat: number; lng: number };
export function hasAddressCoordinates(
  result: AddressResult
): result is LocatedAddressResult {
  return (
    typeof result.lat === "number" &&
    Number.isFinite(result.lat) &&
    result.lat !== 0 &&
    Math.abs(result.lat) <= 90 &&
    typeof result.lng === "number" &&
    Number.isFinite(result.lng) &&
    result.lng !== 0 &&
    Math.abs(result.lng) <= 180
  );
}
const cache = new Map<string, AddressResult[]>();
const pending = new Map<string, Promise<AddressResult[]>>();
export function normalizeAddressResults(value: unknown): AddressResult[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value
    .filter(
      item =>
        item &&
        (typeof item.roadAddress === "string" ||
          typeof item.jibunAddress === "string")
    )
    .map(item => {
      // NAVER returns longitude as x and latitude as y, in WGS84 degrees.
      const point = {
        lat:
          typeof item.y === "string" || typeof item.y === "number"
            ? Number(item.y)
            : NaN,
        lng:
          typeof item.x === "string" || typeof item.x === "number"
            ? Number(item.x)
            : NaN,
      };
      return {
        roadAddress:
          typeof item.roadAddress === "string" ? item.roadAddress.trim() : "",
        jibunAddress:
          typeof item.jibunAddress === "string" ? item.jibunAddress.trim() : "",
        ...(hasAddressCoordinates({
          roadAddress: "",
          jibunAddress: "",
          ...point,
        })
          ? point
          : {}),
      };
    })
    .filter(item => {
      const key = item.roadAddress || item.jibunAddress;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}
export async function searchAddresses(input: string): Promise<AddressResult[]> {
  const query = input.trim().replace(/\s+/g, " ");
  if (query.length < 2)
    throw new Error("도로명이나 지번 주소를 2자 이상 입력해 주세요.");
  if (cache.has(query)) return cache.get(query)!;
  if (pending.has(query)) return pending.get(query)!;
  const request = (async () => {
    await ensureNaverMapsSdk();
    if (typeof naver.maps.Service?.geocode !== "function") {
      await new Promise<void>((resolve, reject) => {
        const started = Date.now();
        const timer = window.setInterval(() => {
          if (typeof naver.maps.Service?.geocode === "function") {
            window.clearInterval(timer);
            resolve();
          } else if (Date.now() - started > 10000) {
            window.clearInterval(timer);
            reject(
              new Error(
                "주소 검색을 불러오지 못했어요. 페이지를 새로고침해 주세요."
              )
            );
          }
        }, 100);
      });
    }
    return new Promise<AddressResult[]>((resolve, reject) => {
      const timeout = window.setTimeout(
        () =>
          reject(
            new Error(
              "주소 검색이 지연되고 있어요. 잠시 후 다시 검색해 주세요."
            )
          ),
        10000
      );
      if (typeof naver.maps.Service?.geocode !== "function") {
        window.clearTimeout(timeout);
        reject(
          new Error(
            "주소 검색을 불러오지 못했어요. 페이지를 새로고침해 주세요."
          )
        );
        return;
      }
      naver.maps.Service.geocode({ query }, (status, response) => {
        window.clearTimeout(timeout);
        if (status !== naver.maps.Service.Status.OK) {
          reject(
            new Error(
              "주소 검색에 연결하지 못했어요. 잠시 후 다시 시도하거나 주소를 직접 입력해 주세요."
            )
          );
          return;
        }
        const results = normalizeAddressResults(response.v2?.addresses);
        if (cache.size >= 50) cache.delete(cache.keys().next().value!);
        cache.set(query, results);
        resolve(results);
      });
    });
  })();
  pending.set(query, request);
  try {
    return await request;
  } finally {
    pending.delete(query);
  }
}
