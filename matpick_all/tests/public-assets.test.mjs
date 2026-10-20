import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { lightweightPublicAssets } from "../scripts/public-assets.mjs";

test("build excludes originals but retains main photos, thumbnails, icons and crawler files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "matpick-assets-"));
  try {
    const input = path.join(root, "public");
    const output = path.join(root, "dist");
    await mkdir(path.join(input, "card-data", "nested"), { recursive: true });
    await mkdir(path.join(input, "source-covers"), { recursive: true });
    await mkdir(path.join(input, "restaurant-image-previews"), { recursive: true });
    await mkdir(path.join(input, "dining-moments"), { recursive: true });
    await writeFile(path.join(input, "card-data", "nested", "photo.jpg"), "photo");
    await writeFile(path.join(input, "source-covers", "cover.svg"), "cover");
    await writeFile(path.join(input, "restaurant-image-previews", "photo.webp"), "thumbnail");
    await writeFile(path.join(input, "dining-moments", "main.jpg"), "main");
    await writeFile(path.join(input, "favicon.ico"), "icon");
    await writeFile(path.join(input, "robots.txt"), "robots");
    await lightweightPublicAssets(input, output).closeBundle();
    assert.deepEqual((await readdir(output)).sort(), [
      "dining-moments", "favicon.ico", "restaurant-image-previews", "robots.txt", "source-covers",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
