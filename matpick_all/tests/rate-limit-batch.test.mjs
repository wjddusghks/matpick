import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { checkRateLimit, enforceRateLimits } = require("../../api/_rateLimit.js");

function responseRecorder() {
  return {
    statusCode: 0,
    body: null,
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function policies(prefix, minuteLimit = 30, dayLimit = 400) {
  return [
    {
      bucket: `${prefix}:minute`,
      limit: minuteLimit,
      windowSec: 60,
      message: "minute blocked",
    },
    {
      bucket: `${prefix}:day`,
      limit: dayLimit,
      windowSec: 86400,
      message: "day blocked",
    },
  ];
}

test("batched limits succeed only when both policies allow the request", async (t) => {
  const originalUrl = process.env.KV_REST_API_URL;
  const originalToken = process.env.KV_REST_API_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  t.after(() => {
    if (originalUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = originalUrl;
    if (originalToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = originalToken;
  });

  const req = { headers: { "x-forwarded-for": "198.51.100.8" } };

  const allowedResponse = responseRecorder();
  assert.equal(await enforceRateLimits(req, allowedResponse, policies("batch-allowed")), true);
  assert.equal(allowedResponse.statusCode, 0);
  assert.equal(allowedResponse.headers["X-RateLimit-Limit"], "30");
  assert.equal(allowedResponse.headers["X-RateLimit-Window"], "60");
  assert.equal(allowedResponse.headers["Retry-After"], undefined);

  await checkRateLimit({
    bucket: "batch-day-blocked:day",
    subject: "198.51.100.8",
    limit: 1,
    windowSec: 86400,
  });
  const dayBlockedResponse = responseRecorder();
  assert.equal(
    await enforceRateLimits(req, dayBlockedResponse, policies("batch-day-blocked", 30, 1)),
    false,
  );
  assert.equal(dayBlockedResponse.statusCode, 429);
  assert.deepEqual(dayBlockedResponse.body, { error: "day blocked" });
  assert.equal(dayBlockedResponse.headers["X-RateLimit-Limit"], "1");
  assert.equal(dayBlockedResponse.headers["X-RateLimit-Window"], "86400");
  assert.equal(dayBlockedResponse.headers["Retry-After"], "86400");

  await checkRateLimit({
    bucket: "batch-minute-blocked:minute",
    subject: "198.51.100.8",
    limit: 1,
    windowSec: 60,
  });
  const minuteBlockedResponse = responseRecorder();
  assert.equal(
    await enforceRateLimits(req, minuteBlockedResponse, policies("batch-minute-blocked", 1, 400)),
    false,
  );
  assert.equal(minuteBlockedResponse.statusCode, 429);
  assert.deepEqual(minuteBlockedResponse.body, { error: "minute blocked" });
  assert.equal(minuteBlockedResponse.headers["X-RateLimit-Limit"], "1");
  assert.equal(minuteBlockedResponse.headers["X-RateLimit-Window"], "60");
  assert.equal(minuteBlockedResponse.headers["Retry-After"], "60");
});
