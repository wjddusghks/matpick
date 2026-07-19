const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_JSON_BYTES = 1_500_000;

async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const signal = options.signal || AbortSignal.timeout(Math.max(250, timeoutMs));
  return fetch(url, {
    ...options,
    signal,
  });
}

async function readJsonResponse(response, maxBytes = DEFAULT_MAX_JSON_BYTES) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error("Upstream response exceeded the allowed size.");
  }

  const body = await response.text();
  if (Buffer.byteLength(body, "utf8") > maxBytes) {
    throw new Error("Upstream response exceeded the allowed size.");
  }

  try {
    return JSON.parse(body);
  } catch {
    throw new Error("Upstream returned an invalid JSON response.");
  }
}

module.exports = {
  fetchWithTimeout,
  readJsonResponse,
};
