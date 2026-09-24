import { ensureNaverMapsSdk } from "./naverMaps";
export type AddressResult = { roadAddress: string; jibunAddress: string };
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
    .map(item => ({
      roadAddress:
        typeof item.roadAddress === "string" ? item.roadAddress.trim() : "",
      jibunAddress:
        typeof item.jibunAddress === "string" ? item.jibunAddress.trim() : "",
    }))
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
