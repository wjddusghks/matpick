import { cp, mkdir } from "node:fs/promises";
import path from "node:path";

export const retiredImageDirectories = new Set([
  "card-data",
]);

export function isRetiredImageUrl(value = "") {
  return retiredImageDirectories.has(String(value).replace(/^\/+/, "").split("/")[0]);
}

// Keep display-sized photos; only the large source originals stay on the PC.
export function lightweightPublicAssets(publicDirectory, outputDirectory) {
  return {
    name: "lightweight-public-assets",
    apply: "build",
    async closeBundle() {
      await mkdir(outputDirectory, { recursive: true });
      await cp(publicDirectory, outputDirectory, {
        recursive: true,
        filter(source) {
          const relative = path.relative(publicDirectory, source);
          return !relative || !retiredImageDirectories.has(relative.split(path.sep)[0]);
        },
      });
    },
  };
}
