export function getNaverMapsScriptUrl(config: {
  VITE_NAVER_MAP_KEY_ID?: string;
  VITE_NAVER_MAP_CLIENT_ID?: string;
}): string | null {
  const keyId = config.VITE_NAVER_MAP_KEY_ID?.trim();
  const legacyClientId = config.VITE_NAVER_MAP_CLIENT_ID?.trim();
  if (!keyId && !legacyClientId) return null;
  const url = new URL("https://oapi.map.naver.com/openapi/v3/maps.js");
  // Legacy service credentials cannot be assumed to be keys from the new Maps service.
  url.searchParams.set(
    keyId ? "ncpKeyId" : "ncpClientId",
    keyId || legacyClientId!
  );
  url.searchParams.set("submodules", "geocoder");
  return url.href;
}
