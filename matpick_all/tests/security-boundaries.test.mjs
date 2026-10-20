import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { loadAppModules } from "../scripts/load-public-data.mjs";
const require = createRequire(import.meta.url);
const {
  enforceSameOrigin,
  enforceBrowserRequest,
} = require("../../api/_requestGuards.js");
const { checkRateLimit, getClientIp } = require("../../api/_rateLimit.js");
const { authorizeAdminRequest } = require("../../api/admin/_adminAuth.js");
const {
  getPublicOrigin,
  OAuthConfigurationError,
} = require("../../api/auth/_oauthFlow.js");
const {
  consumeOAuthTransaction,
  createOAuthTransaction,
  createSession,
  readSession,
  revokeSession,
  OAUTH_COOKIE,
  SESSION_COOKIE,
} = require("../../api/auth/_sessionStore.js");
const profileHandler = require("../../api/auth/profile.js");
const commentsHandler = require("../../api/comments/index.js");
const kakaoHandler = require("../../api/auth/kakao.js");
const [privacy] = await loadAppModules(["/src/lib/marketingPrivacy.ts"]);
const response = () => ({
  statusCode: 200,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  },
});
function env(t, values) {
  const old = Object.fromEntries(
    Object.keys(values).map(k => [k, process.env[k]])
  );
  for (const [k, v] of Object.entries(values))
    v == null ? delete process.env[k] : (process.env[k] = v);
  t.after(() => {
    for (const [k, v] of Object.entries(old))
      v == null ? delete process.env[k] : (process.env[k] = v);
  });
}

test("production origins cannot be expanded by spoofed forwarding or host headers", t => {
  env(t, {
    VERCEL: "1",
    OAUTH_PUBLIC_ORIGIN: "https://oauth-preview.example.com",
    VITE_PUBLIC_APP_URL: "https://matpick.co.kr",
    VERCEL_URL: "test-project.vercel.app",
  });
  for (const host of ["matpick.co.kr", "attacker.example"]) {
    const res = response();
    assert.equal(
      enforceSameOrigin(
        {
          headers: {
            host,
            "x-forwarded-host": "attacker.example",
            origin: "https://attacker.example",
          },
        },
        res
      ),
      false
    );
    assert.equal(res.statusCode, 403);
  }
  assert.equal(
    enforceSameOrigin(
      { headers: { origin: "https://matpick.co.kr" } },
      response()
    ),
    true
  );
  assert.equal(
    enforceSameOrigin(
      { headers: { origin: "https://test-project.vercel.app" } },
      response()
    ),
    true
  );
  assert.equal(
    enforceSameOrigin(
      { headers: { origin: "https://oauth-preview.example.com" } },
      response()
    ),
    true
  );
  assert.equal(
    enforceBrowserRequest(
      { headers: { "sec-fetch-site": "same-site", host: "matpick.co.kr" } },
      response()
    ),
    false
  );
});

test("OAuth origin is explicit in preview and canonical in production", t => {
  env(t, {
    VERCEL: "1",
    VERCEL_ENV: "preview",
    VERCEL_URL: "feature-preview.vercel.app",
    VERCEL_BRANCH_URL: "english-feedback.vercel.app",
    OAUTH_PUBLIC_ORIGIN: null,
    VITE_PUBLIC_APP_URL: null,
  });
  assert.throws(
    () => getPublicOrigin({ headers: { host: "attacker.example" } }),
    error => error instanceof OAuthConfigurationError &&
      /Preview OAuth is not configured/.test(error.message)
  );
  process.env.VITE_PUBLIC_APP_URL = "https://matpick.co.kr";
  assert.throws(
    () => getPublicOrigin({ headers: {} }),
    error => error instanceof OAuthConfigurationError
  );
  process.env.VITE_PUBLIC_APP_URL = "https://feature-preview.vercel.app";
  assert.equal(
    getPublicOrigin({ headers: { host: "attacker.example" } }),
    "https://feature-preview.vercel.app"
  );
  process.env.OAUTH_PUBLIC_ORIGIN = "https://oauth-preview.example.com";
  assert.equal(
    getPublicOrigin({ headers: { host: "attacker.example" } }),
    "https://oauth-preview.example.com"
  );
  process.env.OAUTH_PUBLIC_ORIGIN = "http://oauth-preview.example.com";
  assert.throws(
    () => getPublicOrigin({ headers: {} }),
    error => error instanceof OAuthConfigurationError &&
      /must be an HTTPS origin/.test(error.message)
  );
  delete process.env.OAUTH_PUBLIC_ORIGIN;
  delete process.env.VITE_PUBLIC_APP_URL;
  process.env.VERCEL_ENV = "production";
  assert.equal(getPublicOrigin({ headers: {} }), "https://matpick.co.kr");
});

test("preview login start returns a clear error before creating OAuth state", async t => {
  env(t, {
    VERCEL: null,
    NODE_ENV: "test",
    VERCEL_ENV: "preview",
    OAUTH_PUBLIC_ORIGIN: null,
    VITE_PUBLIC_APP_URL: null,
    KAKAO_REST_API_KEY: "test-client",
    KV_REST_API_URL: null,
    KV_REST_API_TOKEN: null,
    UPSTASH_REDIS_REST_URL: null,
    UPSTASH_REDIS_REST_TOKEN: null,
  });
  const res = {
    ...response(),
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    getHeader(name) {
      return this.headers[name];
    },
  };
  await kakaoHandler(
    {
      method: "POST",
      headers: { host: "feature-preview.vercel.app" },
      body: { action: "start" },
    },
    res
  );
  assert.equal(res.statusCode, 500);
  assert.match(res.body.error, /Preview OAuth is not configured/);
  assert.equal(res.headers["Set-Cookie"], undefined);
});

test("Vercel rate identity ignores spoofable fallback headers and malformed IPs", t => {
  env(t, { VERCEL: "1" });
  assert.equal(
    getClientIp({ headers: { "x-forwarded-for": "198.51.100.2" } }),
    "unknown"
  );
  assert.equal(
    getClientIp({
      headers: {
        "x-vercel-forwarded-for": "198.51.100.1",
        "x-forwarded-for": "198.51.100.2",
      },
    }),
    "198.51.100.1"
  );
  assert.equal(
    getClientIp({ headers: { "x-vercel-forwarded-for": "not-an-ip" } }),
    "unknown"
  );
});

test("distributed limit increments atomically with expiry and hides IP from URL/key", async t => {
  env(t, {
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "test",
  });
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://redis.example");
    assert.equal(options.method, "POST");
    const command = JSON.parse(options.body);
    assert.equal(command[0], "EVAL");
    assert.match(command[1], /INCR/);
    assert.match(command[1], /EXPIRE/);
    assert.match(command[1], /TTL/);
    assert.equal(command[2], 1);
    assert.equal(command[4], 60);
    assert.ok(!command[3].includes("198.51.100.7"));
    return { ok: true, json: async () => ({ result: 3 }) };
  };
  assert.equal(
    (
      await checkRateLimit({
        bucket: "test",
        subject: "198.51.100.7",
        windowSec: 60,
        limit: 2,
      })
    ).allowed,
    false
  );
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ error: "store failure" }),
  });
  await assert.rejects(
    checkRateLimit({ bucket: "test", subject: "x", limit: 2 }),
    /command failed/
  );
});

test("admin identity comes only from an opaque Redis session cookie", async t => {
  env(t, {
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "test",
    ADMIN_USER_IDS: "naver:naver_admin",
  });
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  const values = new Map();
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (command[0] === "SET") values.set(command[1], command[2]);
    if (command[0] === "DEL") values.delete(command[1]);
    const result =
      command[0] === "GET"
        ? (values.get(command[1]) ?? null)
        : command[0] === "DEL"
          ? 1
          : "OK";
    return { ok: true, json: async () => ({ result }) };
  };
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  await createSession({ headers: {} }, res, {
    id: "naver_admin",
    provider: "naver",
    name: "Admin",
  });
  const setCookie = res.headers["Set-Cookie"][0];
  assert.match(setCookie, /HttpOnly; Secure; SameSite=Lax/);
  const cookie = setCookie.split(";")[0];
  assert.equal(
    (await authorizeAdminRequest({ headers: { cookie } })).valid,
    true
  );
  assert.equal(
    (
      await authorizeAdminRequest({
        headers: {
          "x-matpick-admin-key": "naver:naver_admin",
          "x-matpick-admin-token": "legacy",
        },
      })
    ).valid,
    false
  );
  assert.equal(
    (
      await authorizeAdminRequest({
        headers: { cookie: `${SESSION_COOKIE}=forged` },
      })
    ).valid,
    false
  );
  const logout = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  await revokeSession({ headers: { cookie } }, logout);
  assert.match(
    logout.headers["Set-Cookie"][0],
    /Max-Age=0; HttpOnly; Secure; SameSite=Lax/
  );
  assert.equal(
    (await authorizeAdminRequest({ headers: { cookie } })).valid,
    false
  );
});

test("session storage rejects unsafe configuration and malformed Redis replies", async t => {
  env(t, {
    KV_REST_API_URL: "http://redis.example?token=leak",
    KV_REST_API_TOKEN: "test",
    UPSTASH_REDIS_REST_URL: null,
    UPSTASH_REDIS_REST_TOKEN: null,
  });
  const res = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  await assert.rejects(
    createSession({ headers: {} }, res, { id: "user", provider: "naver" }),
    error => error?.status === 503
  );
  assert.equal(res.headers["Set-Cookie"], undefined);

  process.env.KV_REST_API_URL = "https://redis.example";
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ result: 1 }),
  });
  await assert.rejects(
    createSession({ headers: {} }, res, { id: "user", provider: "naver" }),
    error => error?.status === 503
  );
  assert.equal(res.headers["Set-Cookie"], undefined);

  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ result: "{broken" }),
  });
  await assert.rejects(
    readSession({ headers: { cookie: `${SESSION_COOKIE}=${"a".repeat(43)}` } }),
    error => error?.status === 503
  );
});

test("fresh login rotates the existing session", async t => {
  env(t, {
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "test",
  });
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  const values = new Map();
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (command[0] === "SET") {
      values.set(command[1], command[2]);
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    if (command[0] === "DEL") {
      const existed = values.delete(command[1]);
      return { ok: true, json: async () => ({ result: existed ? 1 : 0 }) };
    }
    if (command[0] === "GET")
      return {
        ok: true,
        json: async () => ({ result: values.get(command[1]) ?? null }),
      };
    throw new Error("unexpected command");
  };
  const first = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  await createSession({ headers: {} }, first, {
    id: "user",
    provider: "naver",
  });
  const oldCookie = first.headers["Set-Cookie"][0].split(";")[0];
  const second = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  await createSession({ headers: { cookie: oldCookie } }, second, {
    id: "user",
    provider: "naver",
  });
  assert.equal(await readSession({ headers: { cookie: oldCookie } }), null);
  const newCookie = second.headers["Set-Cookie"][0].split(";")[0];
  assert.equal(
    (await readSession({ headers: { cookie: newCookie } })).user.id,
    "user"
  );
});

test("OAuth transactions reject future timestamps", async t => {
  env(t, {
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "test",
  });
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  const values = new Map();
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (command[0] === "SET") {
      const transaction = JSON.parse(command[2]);
      transaction.createdAt = Date.now() + 60_000;
      values.set(command[1], JSON.stringify(transaction));
      return { ok: true, json: async () => ({ result: "OK" }) };
    }
    if (command[0] === "GETDEL") {
      const value = values.get(command[1]) ?? null;
      values.delete(command[1]);
      return { ok: true, json: async () => ({ result: value }) };
    }
    throw new Error("unexpected command");
  };
  const start = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  const state = await createOAuthTransaction(start, {
    provider: "naver",
    redirectUri: "https://matpick.co.kr/auth/callback/naver",
  });
  const cookie = start.headers["Set-Cookie"][0].split(";")[0];
  assert.match(cookie, new RegExp(`^${OAUTH_COOKIE}=`));
  const finish = {
    setHeader() {},
    getHeader() {
      return undefined;
    },
  };
  assert.equal(
    await consumeOAuthTransaction({ headers: { cookie } }, finish, {
      provider: "naver",
      state,
    }),
    null
  );
});

test("marketing URL drops secrets, coordinates, free text and fragments", () => {
  const result = privacy.safeMarketingLocation(
    "https://matpick.co.kr/map?lang=en&utm_source=instagram&code=secret&state=secret&email=a%40b.com&lat=37.1&q=private#access_token=secret"
  );
  assert.equal(
    result.page_location,
    "https://matpick.co.kr/map?lang=en&utm_source=instagram"
  );
  for (const path of [
    "/auth/callback/naver?code=secret",
    "/admin/members",
    "/my/favorites",
  ]) {
    assert.equal(privacy.isPrivateMarketingPath(path), true);
    assert.equal(
      privacy.safeMarketingLocation("https://matpick.co.kr" + path),
      null
    );
  }
  assert.equal(privacy.isPrivateMarketingPath("/restaurant/auth-cafe"), false);
});

test("Naver code exchange requires one-time server state and sends credentials in POST body", async t => {
  env(t, {
    NAVER_LOGIN_CLIENT_ID: "test-client",
    NAVER_LOGIN_CLIENT_SECRET: "test-secret",
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "test",
    VERCEL: "1",
    VITE_PUBLIC_APP_URL: null,
  });
  const previousFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = previousFetch));
  const values = new Map();
  globalThis.fetch = async (url, options) => {
    if (url === "https://redis.example") {
      const command = JSON.parse(options.body);
      if (command[0] === "SET") {
        values.set(command[1], command[2]);
        return { ok: true, json: async () => ({ result: "OK" }) };
      }
      if (command[0] === "GETDEL") {
        const value = values.get(command[1]) ?? null;
        values.delete(command[1]);
        return { ok: true, json: async () => ({ result: value }) };
      }
      return { ok: true, json: async () => ({ result: 1 }) };
    }
    assert.equal(url, "https://nid.naver.com/oauth2.0/token");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("client_secret"), "test-secret");
    assert.equal(options.body.get("code"), "test-code");
    return { ok: false, json: async () => ({ error: "invalid_grant" }) };
  };
  const handler = require("../../api/auth/naver.js");
  const start = {
    ...response(),
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  await handler(
    {
      method: "POST",
      headers: { host: "attacker.example", origin: "https://matpick.co.kr" },
      body: { action: "start" },
    },
    start
  );
  assert.equal(start.statusCode, 200);
  const authorizeUrl = new URL(start.body.authorizeUrl);
  assert.equal(
    authorizeUrl.searchParams.get("redirect_uri"),
    "https://matpick.co.kr/auth/callback/naver"
  );
  const cookie = start.headers["Set-Cookie"][0].split(";")[0];
  const res = { ...response(), setHeader() {} };
  await handler(
    {
      method: "POST",
      headers: {
        host: "matpick.co.kr",
        origin: "https://matpick.co.kr",
        cookie,
      },
      body: {
        code: "test-code",
        state: authorizeUrl.searchParams.get("state"),
      },
    },
    res
  );
  assert.equal(res.statusCode, 502);
  assert.ok(!JSON.stringify(res.body).includes("test-secret"));
  const replay = { ...response(), setHeader() {} };
  await handler(
    {
      method: "POST",
      headers: {
        host: "matpick.co.kr",
        origin: "https://matpick.co.kr",
        cookie,
      },
      body: {
        code: "test-code",
        state: authorizeUrl.searchParams.get("state"),
      },
    },
    replay
  );
  assert.equal(replay.statusCode, 400);
});

test("profile persistence carries personal values in request body only", async t => {
  env(t, {
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "test",
  });
  const previousFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = previousFetch));
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://redis.example");
    assert.equal(options.method, "POST");
    const command = JSON.parse(options.body);
    assert.equal(command[0], "HSET");
    assert.ok(command.includes("private-nickname"));
    return { ok: true, json: async () => ({ result: 1 }) };
  };
  const { writeRemoteProfile } = require("../../api/auth/_profileStore.js");
  assert.equal(
    await writeRemoteProfile("test-user", {
      nickname: "private-nickname",
      consentAcceptedAt: Date.now(),
    }),
    true
  );
});

test("profile and comment writes derive account identity from the session", async t => {
  env(t, {
    KV_REST_API_URL: "https://redis.example",
    KV_REST_API_TOKEN: "test",
  });
  const previousFetch = globalThis.fetch;
  t.after(() => (globalThis.fetch = previousFetch));
  const values = new Map();
  const profileKeys = [];
  globalThis.fetch = async (_url, options) => {
    const command = JSON.parse(options.body);
    if (command[0] === "SET") values.set(command[1], command[2]);
    if (command[0] === "GET")
      return {
        ok: true,
        json: async () => ({ result: values.get(command[1]) ?? null }),
      };
    if (command[0] === "HMGET")
      return {
        ok: true,
        json: async () => ({ result: ["ServerNick", "1", "0"] }),
      };
    if (command[0] === "HSET") profileKeys.push(command[1]);
    return {
      ok: true,
      json: async () => ({ result: command[0] === "EVAL" ? 1 : "OK" }),
    };
  };
  const sessionResponse = {
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    getHeader(k) {
      return this.headers[k];
    },
  };
  await createSession({ headers: {} }, sessionResponse, {
    id: "real-user",
    provider: "naver",
    name: "Real User",
  });
  const cookie = sessionResponse.headers["Set-Cookie"][0].split(";")[0];
  const makeResponse = () => ({
    statusCode: 200,
    headers: {},
    setHeader(k, v) {
      this.headers[k] = v;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  });
  const profileRes = makeResponse();
  await profileHandler(
    {
      method: "POST",
      headers: { cookie },
      body: {
        userId: "forged-user",
        syncToken: "legacy-bearer",
        profile: {
          nickname: "RealNick",
          consentAcceptedAt: Date.now(),
          allowLocationPersonalization: false,
        },
      },
    },
    profileRes
  );
  assert.equal(profileRes.statusCode, 200);
  assert.ok(profileKeys.includes("matpick:auth-profile:real-user"));
  assert.ok(!profileKeys.includes("matpick:auth-profile:forged-user"));
  const commentRes = makeResponse();
  await commentsHandler(
    {
      method: "POST",
      headers: { cookie },
      body: {
        restaurantId: "r_test",
        userId: "forged-user",
        syncToken: "legacy-bearer",
        comment: { user: "Attacker", text: "session identity comment" },
      },
    },
    commentRes
  );
  assert.equal(commentRes.statusCode, 200);
  assert.equal(commentRes.body.comment.user, "ServerNick");
});
