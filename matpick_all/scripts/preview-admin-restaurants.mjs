// Isolated UI preview: all restaurant writes stay in this process memory.
import { createServer } from "vite";
import { randomUUID } from "node:crypto";
import dataset from "../client/src/data/generated/public-dataset.json" with { type: "json" };

const previewRestaurants = dataset.restaurants.slice(0, 80);
const previewIds = new Set(previewRestaurants.map(restaurant => restaurant.id));
const previewLinks = dataset.sourceLinks.filter(link =>
  previewIds.has(link.restaurantId)
);
const edits = new Map();
const previewIdentity = {
  user: {
    id: "local-restaurant-preview",
    name: "로컬 관리자",
    provider: "naver",
    syncToken: "local-preview-token",
  },
  isLoggedIn: true,
};

function effectiveRestaurants() {
  const created = [...edits.values()]
    .filter(edit => edit.createdAt)
    .map(edit => ({ id: edit.restaurantId, ...edit.changes }));
  return [...previewRestaurants, ...created];
}

const server = await createServer({
  cacheDir: "node_modules/.vite-admin-restaurants-preview",
  define: {
    "import.meta.env.VITE_ADMIN_USER_IDS": JSON.stringify(
      "naver:local-restaurant-preview"
    ),
    "import.meta.env.VITE_NAVER_MAP_KEY_ID": JSON.stringify("preview-key"),
  },
  server: { host: "127.0.0.1", port: 5187, strictPort: true },
  plugins: [
    {
      name: "isolated-admin-restaurant-preview",
      enforce: "pre",
      resolveId(source, importer) {
        const normalized = importer?.replaceAll("\\", "/") || "";
        if (
          (source === "@/contexts/AuthContext" ||
            source.replaceAll("\\", "/").endsWith("/contexts/AuthContext")) &&
          normalized.endsWith("/pages/AdminRestaurants.tsx")
        )
          return "\0admin-restaurants-preview-auth";
        if (
          (source === "@/lib/addressSearch" ||
            source.replaceAll("\\", "/").endsWith("/lib/addressSearch")) &&
          normalized.endsWith("/components/admin/AdminAddressLookup.tsx")
        )
          return "\0admin-restaurants-preview-address";
        if (
          (source === "./components/monetization/AdBlockGate" ||
            source
              .replaceAll("\\", "/")
              .endsWith("/components/monetization/AdBlockGate")) &&
          normalized.endsWith("/App.tsx")
        )
          return "\0admin-restaurants-preview-gate";
      },
      load(id) {
        if (id === "\0admin-restaurants-preview-auth")
          return `const context = ${JSON.stringify(previewIdentity)}; export function useAuth() { return context; }`;
        if (id === "\0admin-restaurants-preview-address")
          return `
            export function hasAddressCoordinates(value) { return Number.isFinite(value?.lat) && Number.isFinite(value?.lng); }
            export async function searchAddresses(query) {
              return [{ roadAddress: query.trim(), jibunAddress: "서울 마포구 합정동 1-1", lat: 37.5509, lng: 126.9138 }];
            }
          `;
        if (id === "\0admin-restaurants-preview-gate")
          return `export default function AdBlockGate({ children }) { return children; }`;
      },
      transformIndexHtml(html) {
        return html.replace(
          "<body>",
          '<body><div style="position:fixed;bottom:0;left:0;right:0;z-index:99999;background:#382c31;color:#fff;text-align:center;padding:7px;font:11px sans-serif">로컬 미리보기 · 등록과 수정은 메모리에만 저장되며 운영 데이터에 반영되지 않습니다.</div>'
        );
      },
      configureServer(viteServer) {
        viteServer.middlewares.use(async (req, res, next) => {
          if (!req.url?.startsWith("/api/")) return next();
          const url = new URL(req.url, "http://127.0.0.1:5187");
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          if (url.pathname !== "/api/restaurants") {
            res.statusCode = 404;
            res.end(JSON.stringify({ error: "Preview API only" }));
            return;
          }
          if (req.method === "GET") {
            const restaurants = effectiveRestaurants();
            res.end(
              JSON.stringify({
                configured: true,
                edits: [...edits.values()],
                catalog: {
                  restaurants,
                  sources: dataset.sources,
                  sourceLinks: [
                    ...previewLinks.filter(
                      link =>
                        !edits.get(link.restaurantId)?.changes?.sourceLinks
                    ),
                    ...[...edits.values()].flatMap(
                      edit => edit.changes.sourceLinks || []
                    ),
                  ],
                  pageSize: 800,
                  totalCount: restaurants.length,
                  nextCursor: null,
                },
              })
            );
            return;
          }
          let raw = "";
          for await (const chunk of req) raw += chunk;
          const body = JSON.parse(raw || "{}");
          if (body.action === "create") {
            const existing = [...edits.values()].find(
              edit => edit.requestId === body.requestId
            );
            if (existing) {
              res.end(JSON.stringify({ ok: true, edit: existing }));
              return;
            }
            const restaurantId = `preview_${randomUUID().replaceAll("-", "")}`;
            const now = new Date().toISOString();
            const edit = {
              restaurantId,
              revision: 1,
              createdAt: now,
              updatedAt: now,
              deletedAt: null,
              requestId: body.requestId,
              changes: {
                ...body.changes,
                sourceLinks: body.changes.sourceLinks.map((link, index) => ({
                  ...link,
                  id: `admin:${restaurantId}:${index + 1}`,
                  restaurantId,
                })),
              },
            };
            edits.set(restaurantId, edit);
            res.statusCode = 201;
            res.end(JSON.stringify({ ok: true, edit }));
            return;
          }
          const current = edits.get(body.restaurantId);
          const edit = {
            restaurantId: body.restaurantId,
            revision: (current?.revision || 0) + 1,
            updatedAt: new Date().toISOString(),
            deletedAt:
              body.action === "delete"
                ? new Date().toISOString()
                : body.action === "restore"
                  ? null
                  : current?.deletedAt || null,
            changes: {
              ...(current?.changes || {}),
              ...(body.action === "save" ? body.changes : {}),
            },
          };
          edits.set(body.restaurantId, edit);
          res.end(JSON.stringify({ ok: true, edit }));
        });
      },
    },
  ],
});

await server.listen();
console.log(
  "Admin restaurant preview (memory only): http://127.0.0.1:5187/admin/restaurants"
);
