// Optional, loopback-only UI fixture. No production credentials or auth changes.
import { createServer } from "vite";
import { createRequire } from "node:module";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
process.env.AUTH_PROFILE_SIGNING_SECRET = randomBytes(32).toString("hex");
process.env.ADMIN_USER_IDS = "naver:topic-preview";
for (const key of [
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
])
  delete process.env[key];
const handler = require("../../api/admin/_topicResearch.js");
const { createProfileSyncToken } = require("../../api/auth/_profileStore.js");
const server = await createServer({
  configFile: false,
  root: path.join(root, "client"),
  envFile: false,
  cacheDir: path.join(root, "node_modules/.vite-topic-preview"),
  plugins: [react(), tailwindcss()],
  optimizeDeps: {
    entries: [path.join(root, "tests/fixtures/topic-research-preview.tsx")],
  },
  resolve: {
    alias: [
      {
        find: "@/contexts/AuthContext",
        replacement: path.join(
          root,
          "tests/fixtures/topic-research-preview-auth.ts"
        ),
      },
      {
        find: "@/lib/admin",
        replacement: path.join(
          root,
          "tests/fixtures/topic-research-preview-auth.ts"
        ),
      },
      { find: "@", replacement: path.join(root, "client/src") },
    ],
  },
  server: {
    host: "127.0.0.1",
    port: 40393,
    strictPort: true,
    fs: { allow: [root] },
  },
  appType: "custom",
});
server.middlewares.use(async (req, res, next) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (url.pathname === "/api/restaurants") {
    req.query = Object.fromEntries(url.searchParams);
    req.headers["x-matpick-admin-key"] = "naver:topic-preview";
    req.headers["x-matpick-admin-token"] =
      createProfileSyncToken("topic-preview");
    res.status = c => {
      res.statusCode = c;
      return res;
    };
    res.json = body => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(body));
    };
    return handler(req, res);
  }
  if (url.pathname === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(
      await server.transformIndexHtml(
        "/",
        `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module" src="/@fs/${root.replaceAll("\\", "/")}/tests/fixtures/topic-research-preview.tsx"></script></body></html>`
      )
    );
    return;
  }
  next();
});
await server.listen();
console.log("Local research UI fixture: http://127.0.0.1:40393/");
