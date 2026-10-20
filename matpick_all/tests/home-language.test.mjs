import test from "node:test";
import assert from "node:assert/strict";
import * as locale from "../client/src/lib/locale.ts";

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

test("an explicit URL language takes priority over the stored preference", t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  t.after(() => original ? Object.defineProperty(globalThis, "window", original) : delete globalThis.window);

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "?lang=en" },
      localStorage: { getItem: () => "ko" },
    },
  });
  assert.equal(locale.getBrowserFallbackLocale(), "en");

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      location: { search: "?lang=ko" },
      localStorage: { getItem: () => "en" },
    },
  });
  assert.equal(locale.getBrowserFallbackLocale(), "ko");
});
