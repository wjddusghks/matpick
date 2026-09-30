// Isolated UI preview: no real KV, authentication, analytics or catalog writes.
import { createServer } from "vite";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const handler = require("../../api/restaurants/index.js");
const { createProfileSyncToken } = require("../../api/auth/_profileStore.js");
const {
  validateSuggestion,
  saveSuggestion,
} = require("../../api/restaurants/_suggestionStore.js");
const stored = new Map();
const counts = new Map();
const hashes = new Map();
process.env.KV_REST_API_URL = "https://suggestion-preview.invalid";
process.env.KV_REST_API_TOKEN = "local-preview-only";
process.env.ADMIN_USER_IDS = "naver:local-suggestion-preview";
process.env.AUTH_PROFILE_SIGNING_SECRET = "local-suggestion-preview-only";
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  if (!String(url).startsWith("https://suggestion-preview.invalid"))
    return realFetch(url, options);
  const command = options?.body
    ? JSON.parse(options.body)
    : new URL(url).pathname.slice(1).split("/").map(decodeURIComponent);
  let result;
  if (command[0] === "INCR") {
    result = (counts.get(command[1]) || 0) + 1;
    counts.set(command[1], result);
  } else if (command[0] === "EXPIRE" || command[0] === "ZREMRANGEBYSCORE")
    result = 1;
  else if (command[0] === "ZCARD") result = stored.size;
  else if (command[0] === "ZREVRANGE")
    result = [...stored.keys()]
      .reverse()
      .slice(Number(command[2]), Number(command[3]) + 1);
  else if (command[0] === "MGET")
    result = command.slice(1).map(key => stored.get(key) || null);
  else if (command[0] === "GET") result = stored.get(command[1]) || null;
  else if (command[0] === "HVALS")
    result = [...(hashes.get(command[1])?.values() || [])];
  else if (command[0] === "EVAL" && command[2] === 2) {
    if (!stored.has(command[3])) stored.set(command[3], command[5]);
    result = stored.get(command[3]);
  } else if (command[0] === "EVAL" && command[2] === 4) {
    const raw = stored.get(command[3]);
    if (!raw) result = 0;
    else {
      const status = command[7];
      stored.set(command[3], JSON.stringify({ ...JSON.parse(command[12]), status }));
      const publications = hashes.get(command[4]) || new Map();
      hashes.set(command[4], publications);
      const publishedId = `community-${JSON.parse(raw).requestId}`;
      if (status === "approved" && command[13] === "publish") publications.set(publishedId, command[9]);
      else if (status !== "approved") publications.delete(publishedId);
      result = 1;
    }
  } else throw new Error("Unimplemented preview command");
  return { ok: true, json: async () => ({ result }) };
};
await saveSuggestion(
  validateSuggestion({
    requestId: randomUUID(),
    name: "[미리보기] 바다국밥",
    location: "부산 해운대구 · 가상 테스트 주소",
    menus: [
      { name: "돼지국밥", price: "10000", unit: "1인분" },
      { name: "수육", price: "", unit: "소" },
    ],
    consent: true,
    tags: ["혼밥", "여행"],
    reason: "UI 검수용 가상 제보입니다. 실제 식당 정보가 아닙니다.",
  })
);
const previewIdentity = {
  user: {
    id: "local-suggestion-preview",
    provider: "naver",
    syncToken: createProfileSyncToken("local-suggestion-preview"),
  },
  isLoggedIn: true,
};
const server = await createServer({
  cacheDir: "node_modules/.vite-suggestions-preview",
  define: {
    "import.meta.env.VITE_ADMIN_USER_IDS": JSON.stringify(
      "naver:local-suggestion-preview"
    ),
  },
  server: { host: "127.0.0.1", port: 5186, strictPort: true },
  plugins: [
    {
      name: "isolated-suggestion-preview",
      enforce: "pre",
      resolveId(source, importer) {
        if (
          (source === "@/contexts/AuthContext" ||
            source.replaceAll("\\", "/").endsWith("/contexts/AuthContext")) &&
          ["/pages/AdminSuggestions.tsx", "/lib/useSuggestionInbox.ts"].some(suffix =>
            importer?.replaceAll("\\", "/").endsWith(suffix)
          )
        )
          return "\0suggestion-preview-auth";
      },
      load(id) {
        if (id === "\0suggestion-preview-auth")
          return `const context = ${JSON.stringify(previewIdentity)}; export function useAuth() { return context; }`;
      },
      transformIndexHtml(html) {
        return html.replace(
          "<body>",
          '<body><div style="position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#382c31;color:#fff;text-align:center;padding:7px;font:11px sans-serif">로컬 미리보기 · 제보는 테스트 메모리에만 저장됩니다. 운영 데이터에 반영되지 않습니다.</div>'
        );
      },
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();
          const url = new URL(req.url, "http://127.0.0.1:5186");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          if (url.pathname !== "/api/restaurants") {
            res.end(
              JSON.stringify({ ok: true, edits: [], reviews: [], comments: [] })
            );
            return;
          }
          let body = "";
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 30000) {
              res.statusCode = 413;
              res.end("{}");
              return;
            }
          }
          req.body = body || undefined;
          req.query = Object.fromEntries(url.searchParams);
          req.headers["x-forwarded-proto"] = "http";
          res.status = code => {
            res.statusCode = code;
            return res;
          };
          res.json = value => {
            res.end(JSON.stringify(value));
            return res;
          };
          await handler(req, res);
        });
      },
    },
  ],
});
await server.listen();
console.log(
  "Suggestion preview (test data only): http://127.0.0.1:5186/suggest"
);
