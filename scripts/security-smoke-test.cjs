const assert = require("node:assert/strict");
const {
  enforceSameOrigin,
  isAllowedRedirectUri,
  readJsonBody,
} = require("../api/_requestGuards");
const { readJsonResponse } = require("../api/_safeFetch");
const { enforceRateLimit } = require("../api/_rateLimit");
const { getConfiguredAdminKeys } = require("../api/admin/_adminAuth");

function createResponse() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.payload = payload;
      return this;
    },
  };
}

async function testRequestGuards() {
  process.env.VERCEL_ENV = "production";
  process.env.VITE_PUBLIC_APP_URL = "https://matpick.co.kr";
  process.env.RATE_LIMIT_ALLOW_MEMORY_FALLBACK = "1";

  const allowedRequest = {
    headers: {
      origin: "https://matpick.co.kr",
      host: "matpick.co.kr",
      "x-forwarded-proto": "https",
    },
  };
  assert.equal(enforceSameOrigin(allowedRequest, createResponse()), true);
  assert.equal(
    isAllowedRedirectUri(
      allowedRequest,
      "https://matpick.co.kr/auth/callback/kakao",
      "/auth/callback/kakao"
    ),
    true
  );
  assert.equal(
    isAllowedRedirectUri(
      allowedRequest,
      "https://evil.example/auth/callback/kakao",
      "/auth/callback/kakao"
    ),
    false
  );
  assert.equal(
    isAllowedRedirectUri(
      allowedRequest,
      "https://matpick.co.kr/auth/callback/kakao?next=https://evil.example",
      "/auth/callback/kakao"
    ),
    false
  );

  const rejectedResponse = createResponse();
  assert.equal(
    enforceSameOrigin(
      {
        headers: {
          origin: "https://evil.example",
          host: "evil.example",
          "x-forwarded-proto": "https",
        },
      },
      rejectedResponse
    ),
    false
  );
  assert.equal(rejectedResponse.statusCode, 403);

  assert.throws(
    () =>
      readJsonBody(
        {
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "x".repeat(2_000) }),
        },
        { maxBytes: 1_000 }
      ),
    (error) => error.statusCode === 413
  );

  await assert.rejects(
    () =>
      readJsonResponse(
        new Response(JSON.stringify({ text: "x".repeat(2_000) }), {
          headers: { "content-type": "application/json" },
        }),
        1_000
      ),
    /exceeded the allowed size/
  );
}

async function testReviewValidation() {
  const handler = require("../api/reviews/index");
  const response = createResponse();
  await handler(
    {
      method: "POST",
      headers: {
        origin: "https://matpick.co.kr",
        host: "matpick.co.kr",
        "x-forwarded-proto": "https",
        "content-type": "application/json",
        "x-forwarded-for": "127.0.0.10",
      },
      body: {
        restaurantId: "restaurant_1",
        userId: "kakao_1",
        syncToken: "invalid",
        review: {
          stars: 5,
          text: "test",
          user: "user",
          photos: ["javascript:alert(1)"],
        },
      },
      query: {},
    },
    response
  );
  assert.equal(response.statusCode, 400);
  assert.equal(response.payload?.error, "Invalid review payload");
}

async function testProductionRateLimitFailClosed() {
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  delete process.env.RATE_LIMIT_ALLOW_MEMORY_FALLBACK;
  process.env.VERCEL_ENV = "production";
  const response = createResponse();
  const allowed = await enforceRateLimit(
    { headers: {} },
    response,
    { bucket: "security-test", subject: "test", limit: 1, windowSec: 60 }
  );
  assert.equal(allowed, false);
  assert.equal(response.statusCode, 503);
  process.env.RATE_LIMIT_ALLOW_MEMORY_FALLBACK = "1";
}

function testAdminConfiguration() {
  delete process.env.ADMIN_USER_IDS;
  process.env.VITE_ADMIN_USER_IDS = "kakao:public-client-value";
  process.env.VERCEL_ENV = "production";
  assert.equal(getConfiguredAdminKeys().size, 0);
}

async function main() {
  await testRequestGuards();
  await testReviewValidation();
  await testProductionRateLimitFailClosed();
  testAdminConfiguration();
  console.log("Security smoke tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
