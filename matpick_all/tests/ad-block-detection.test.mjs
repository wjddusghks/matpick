import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";
const source = fs.readFileSync(
  new URL("../client/src/lib/adBlockDetection.ts", import.meta.url),
  "utf8"
);
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2022 },
}).outputText;
const { classifyAdProbe, isAdGateExempt, detectAdBlock } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
);

test("only independent confirmed filter signals block; uncertain layout fails open", () => {
  assert.equal(classifyAdProbe(true, [true, true]), "blocked");
  assert.equal(classifyAdProbe(true, [true, false]), "clear");
  assert.equal(classifyAdProbe(false, [true, true]), "unknown");
  assert.equal(classifyAdProbe(true, []), "unknown");
});
test("support, legal, auth and admin remain accessible", () => {
  for (const path of [
    "/admin",
    "/admin/restaurants",
    "/auth/callback/naver",
    "/privacy",
    "/terms/",
    "/contact",
  ])
    assert.equal(isAdGateExempt(path), true, path);
  for (const path of ["/", "/map", "/restaurant/test", "/explore"])
    assert.equal(isAdGateExempt(path), false, path);
});
test("detection cleans probes, allows retry, and does not confuse offline/hidden/error with blocking", async () => {
  const saved = Object.fromEntries(
    ["document", "navigator", "getComputedStyle", "setTimeout"].map(key => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  );
  let blocked = true;
  const nodes = [];
  const doc = {
    visibilityState: "visible",
    createElement() {
      return {
        className: "",
        isConnected: false,
        style: {},
        setAttribute() {},
        getBoundingClientRect: () => ({ height: 10 }),
        remove() {
          this.isConnected = false;
        },
      };
    },
    body: {
      appendChild(node) {
        node.isConnected = true;
        nodes.push(node);
      },
    },
  };
  try {
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: doc,
    });
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      value: { onLine: true },
    });
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: node => ({
        display: blocked && node.className ? "none" : "block",
        visibility: "visible",
        opacity: "1",
      }),
    });
    globalThis.setTimeout = callback => {
      callback();
      return 0;
    };
    assert.equal(await detectAdBlock(), "blocked");
    assert.ok(nodes.every(node => !node.isConnected));
    blocked = false;
    assert.equal(await detectAdBlock(), "clear");
    navigator.onLine = false;
    assert.equal(await detectAdBlock(), "unknown");
    navigator.onLine = true;
    doc.visibilityState = "hidden";
    assert.equal(await detectAdBlock(), "unknown");
    doc.visibilityState = "visible";
    Object.defineProperty(globalThis, "getComputedStyle", {
      configurable: true,
      value: () => {
        throw Error("unavailable");
      },
    });
    assert.equal(await detectAdBlock(), "unknown");
    assert.ok(nodes.every(node => !node.isConnected));
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
