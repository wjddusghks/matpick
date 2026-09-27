import { createServer } from "vite";
const port = Number(process.env.ADMIN_PREVIEW_PORT || 3011);
const server = await createServer({
  server: { port, host: "127.0.0.1", strictPort: true },
  plugins: [
    {
      name: "admin-editor-local-preview",
      configureServer(server) {
        server.middlewares.use(
          "/__admin-editor-preview",
          async (_req, res, next) => {
            try {
              const html = await server.transformIndexHtml(
                "/__admin-editor-preview",
                '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>맛픽 관리자 · 로컬 검수</title></head><body><div id="root"></div><script type="module" src="/@fs/' +
                  import.meta.dirname.replaceAll("\\", "/") +
                  '/../tests/fixtures/admin-editor-preview.tsx"></script></body></html>'
              );
              res.setHeader("Content-Type", "text/html; charset=utf-8");
              res.end(html);
            } catch (error) {
              next(error);
            }
          }
        );
      },
    },
  ],
});
await server.listen();
console.log(
  `Local-only admin preview: http://localhost:${port}/__admin-editor-preview`
);
