import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")
);

function canonicalLocation(redirect, requestUrl) {
  const url = new URL(requestUrl);
  const host = redirect.has?.find(condition => condition.type === "host");
  if (host?.value !== url.host) return null;
  assert.equal(redirect.source, "/:path*");
  const path = url.pathname.slice(1);
  const destination = redirect.destination.replace(":path*", path);
  // Vercel static redirects preserve source query strings by default.
  return `${destination}${url.search}`;
}

test("www canonical redirect preserves application and OAuth callback URLs", () => {
  const redirect = config.redirects[0];
  assert.deepEqual(redirect, {
    source: "/:path*",
    has: [{ type: "host", value: "www.matpick.co.kr" }],
    destination: "https://matpick.co.kr/:path*",
    permanent: true,
  });
  assert.equal(
    canonicalLocation(
      redirect,
      "https://www.matpick.co.kr/api/auth/profile?lang=en&next=%2Fadmin"
    ),
    "https://matpick.co.kr/api/auth/profile?lang=en&next=%2Fadmin"
  );
  assert.equal(
    canonicalLocation(
      redirect,
      "https://www.matpick.co.kr/auth/callback/naver?code=test-code&state=test-state"
    ),
    "https://matpick.co.kr/auth/callback/naver?code=test-code&state=test-state"
  );
  assert.equal(
    canonicalLocation(redirect, "https://www.matpick.co.kr/?lang=en"),
    "https://matpick.co.kr/?lang=en"
  );
  assert.equal(
    canonicalLocation(redirect, "https://matpick.co.kr/auth/callback/kakao?code=test"),
    null
  );
});
