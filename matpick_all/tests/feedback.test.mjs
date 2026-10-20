import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url);
const store = require("../../api/feedback/_feedbackStore.js");
const { createFeedbackHandler } = require("../../api/feedback/_feedback.js");
const { createSession } = require("../../api/auth/_sessionStore.js");

const base = () => ({
  requestId: randomUUID(),
  category: "improvement",
  message:
    "검색 결과에서 영업 중인 식당을 더 쉽게 구분할 수 있으면 좋겠습니다.",
  language: "ko",
  pagePath: "/explore/topic/test",
  consent: true,
});
function response() {
  return {
    code: 200,
    headers: {},
    body: null,
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
}
function request(method, body = {}, headers = {}) {
  return {
    method,
    body,
    headers: { "x-forwarded-for": randomUUID(), ...headers },
    query: {},
  };
}

test("feedback validation minimizes data and strips unsupported fields", () => {
  const result = store.validateFeedback({
    ...base(),
    email: "person@example.com",
    userId: "someone",
  });
  assert.deepEqual(Object.keys(result).sort(), [
    "category",
    "language",
    "message",
    "pagePath",
    "requestId",
  ]);
  for (const patch of [
    { category: "praise" },
    { message: "too short" },
    { message: "x".repeat(2001) },
    { language: "fr" },
    { pagePath: "/search?q=private" },
    { pagePath: "https://example.test/" },
    { consent: false },
    { website: "bot" },
    { requestId: "invalid" },
  ])
    assert.throws(() => store.validateFeedback({ ...base(), ...patch }), {
      status: 400,
    });
});

test("anonymous submission works but invalid and oversized bodies are rejected", async () => {
  const backend = {
    ...store,
    saveFeedback: async value => ({
      id: "saved",
      status: "new",
      createdAt: Date.now(),
      value,
    }),
  };
  const handler = createFeedbackHandler(backend);
  const ok = response();
  await handler(request("POST", base()), ok);
  assert.equal(ok.code, 200);
  assert.equal(ok.body.ok, true);
  const invalid = response();
  await handler(request("POST", { ...base(), message: "short" }), invalid);
  assert.equal(invalid.code, 400);
  const multibyte = response();
  await handler(
    request("POST", { ...base(), message: "가".repeat(2000) }),
    multibyte
  );
  assert.equal(multibyte.code, 200);
  const large = response();
  await handler(request("POST", "x".repeat(12001)), large);
  assert.equal(large.code, 413);
});

test("feedback inbox and status changes require an allowlisted server session", async t => {
  const previousAdmins = process.env.ADMIN_USER_IDS;
  const previousUrl = process.env.KV_REST_API_URL;
  const previousToken = process.env.KV_REST_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.ADMIN_USER_IDS = "naver:test-admin";
  process.env.KV_REST_API_URL = "https://session.test";
  process.env.KV_REST_API_TOKEN = "test";
  const values = new Map();
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (command[0] === "SET") values.set(command[1], command[2]);
    const result =
      command[0] === "GET"
        ? (values.get(command[1]) ?? null)
        : command[0] === "EVAL"
          ? 1
          : "OK";
    return { ok: true, json: async () => ({ result }) };
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousAdmins === undefined) delete process.env.ADMIN_USER_IDS;
    else process.env.ADMIN_USER_IDS = previousAdmins;
    if (previousUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = previousToken;
  });
  const backend = {
    ...store,
    listFeedback: async () => ({ items: [], total: 0 }),
    updateFeedback: async (requestId, status) => ({ requestId, status }),
  };
  const handler = createFeedbackHandler(backend);
  for (const method of ["GET", "PATCH"]) {
    const denied = response();
    await handler(request(method), denied);
    assert.equal(denied.code, 403);
  }
  const cookieResponse = response();
  cookieResponse.getHeader = name => cookieResponse.headers[name];
  await createSession({ headers: {} }, cookieResponse, {
    id: "test-admin",
    provider: "naver",
    name: "Admin",
  });
  const headers = {
    cookie: cookieResponse.headers["Set-Cookie"][0].split(";")[0],
  };
  const allowed = response();
  await handler(
    { ...request("GET", {}, headers), query: { page: "0" } },
    allowed
  );
  assert.equal(allowed.code, 200);
  assert.deepEqual(allowed.body.items, []);
});

test("missing or unacknowledged durable storage never reports success", async t => {
  const previousUrl = process.env.KV_REST_API_URL;
  const previousToken = process.env.KV_REST_API_TOKEN;
  delete process.env.KV_REST_API_URL;
  delete process.env.KV_REST_API_TOKEN;
  t.after(() => {
    if (previousUrl !== undefined) process.env.KV_REST_API_URL = previousUrl;
    if (previousToken !== undefined)
      process.env.KV_REST_API_TOKEN = previousToken;
  });
  await assert.rejects(store.saveFeedback(store.validateFeedback(base())), {
    status: 503,
  });
});

test("durable writes are idempotent, retained for 90 days, and status updates preserve TTL", async t => {
  const previousUrl = process.env.KV_REST_API_URL;
  const previousToken = process.env.KV_REST_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.KV_REST_API_URL = "https://feedback.test";
  process.env.KV_REST_API_TOKEN = "test";
  const commands = [];
  let saved = "";
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    commands.push(command);
    if (command[0] === "EVAL" && command[2] === 2) {
      saved ||= command[5];
      return { ok: true, json: async () => ({ result: saved }) };
    }
    if (command[0] === "EVAL") {
      const item = JSON.parse(saved);
      item.status = command[5];
      return { ok: true, json: async () => ({ result: JSON.stringify(item) }) };
    }
    return { ok: true, json: async () => ({ result: "OK" }) };
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = previousToken;
  });
  const valid = store.validateFeedback(base());
  const first = await store.saveFeedback(valid);
  const retry = await store.saveFeedback(valid);
  assert.deepEqual(retry, first);
  assert.equal(commands[0].at(-2), store.RETENTION_SECONDS);
  await assert.rejects(
    store.saveFeedback({ ...valid, category: "complaint" }),
    { status: 409 }
  );
  await store.updateFeedback(valid.requestId, "resolved", "test-admin");
  assert.match(commands.at(-1)[1], /PTTL/);
  assert.match(commands.at(-1)[1], /KEEPTTL/);
});

test("an expired feedback item cannot be resurrected during a status update", async t => {
  const previousUrl = process.env.KV_REST_API_URL;
  const previousToken = process.env.KV_REST_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.KV_REST_API_URL = "https://feedback.test";
  process.env.KV_REST_API_TOKEN = "test";
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    assert.equal(command[0], "EVAL");
    assert.match(command[1], /PTTL/);
    return { ok: true, json: async () => ({ result: null }) };
  };
  t.after(() => {
    globalThis.fetch = previousFetch;
    if (previousUrl === undefined) delete process.env.KV_REST_API_URL;
    else process.env.KV_REST_API_URL = previousUrl;
    if (previousToken === undefined) delete process.env.KV_REST_API_TOKEN;
    else process.env.KV_REST_API_TOKEN = previousToken;
  });
  await assert.rejects(
    store.updateFeedback(randomUUID(), "resolved", "admin"),
    { status: 404 }
  );
});
