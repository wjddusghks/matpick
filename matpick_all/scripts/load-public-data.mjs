import { createServer } from "vite";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);

// Execute the same module as the application; do not maintain a second data merger for SEO.
export async function loadPublicData() {
  return (await loadAppModules(["/src/data/index.ts"]))[0];
}

export async function loadAppModules(modules) {
  const server = await createServer({
    configFile: false,
    root: path.join(projectRoot, "client"),
    // Data checks can run beside the development server without replacing its dependency cache.
    cacheDir: path.join(projectRoot, "node_modules/.vite-data-loader"),
    optimizeDeps: { noDiscovery: true, include: [] },
    resolve: { alias: { "@": path.join(projectRoot, "client/src") } },
    server: { middlewareMode: true, watch: null, hmr: false },
    appType: "custom",
    logLevel: "error",
  });
  try {
    return await Promise.all(
      modules.map(module => server.ssrLoadModule(module))
    );
  } finally {
    await server.close();
  }
}
