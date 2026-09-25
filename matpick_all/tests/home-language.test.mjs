import test from "node:test";
import assert from "node:assert/strict";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const [locale] = await loadAppModules(["/src/lib/locale.ts"]);

test("canonical pages default to Korean while respecting an explicit English choice", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => original ? Object.defineProperty(globalThis, "window", original) : delete globalThis.window);
  for (const [stored, expected] of [[null, "ko"], ["en", "en"], ["ko", "ko"], ["invalid", "ko"]]) {
    Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: { getItem: () => stored } } });
    assert.equal(locale.getBrowserFallbackLocale(), expected);
  }
  Object.defineProperty(globalThis, "window", { configurable: true, get() { throw new Error("Unavailable storage"); } });
  assert.equal(locale.getBrowserFallbackLocale(), "ko");
});
