import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const handler = require("../../api/restaurants/index.js");
test("retired guide API returns Gone without any catalog for all callers and methods", async () => {
  for (const method of ["GET", "POST"]) {
    for (const headers of [
      {},
      { "x-matpick-admin-key": "naver:former-admin" },
    ]) {
      const res = {
        headers: {},
        setHeader(k, v) {
          this.headers[k] = v;
        },
        status(code) {
          this.code = code;
          return this;
        },
        json(body) {
          this.body = body;
          return this;
        },
      };
      await handler(
        { method, query: { scope: "private-guides" }, headers },
        res
      );
      assert.equal(res.code, 410);
      assert.deepEqual(Object.keys(res.body), ["error"]);
      assert.equal(res.headers["Cache-Control"], "no-store");
    }
  }
});
