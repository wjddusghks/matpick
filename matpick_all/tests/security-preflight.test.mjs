import test from "node:test";
import assert from "node:assert/strict";
import { inspectSecurityConfig } from "../scripts/security-preflight.mjs";
const good={KV_REST_API_URL:"https://redis.example",KV_REST_API_TOKEN:"secret-value",ADMIN_USER_IDS:"naver:naver_123"};
test("preflight blocks missing Redis/admin config and never exposes values",()=>{
  assert.equal(inspectSecurityConfig({}).ready,false);
  assert.equal(inspectSecurityConfig(good).ready,true);
  assert.ok(!JSON.stringify(inspectSecurityConfig(good)).includes("secret-value"));
  assert.ok(!JSON.stringify(inspectSecurityConfig(good)).includes("naver_123"));
});
test("preflight rejects non-TLS Redis and VITE-prefixed server secrets",()=>{
  assert.equal(inspectSecurityConfig({...good,KV_REST_API_URL:"http://redis.example"}).ready,false);
  assert.equal(inspectSecurityConfig({...good,VITE_REDIS_TOKEN:"do-not-print"}).ready,false);
  assert.equal(inspectSecurityConfig({...good,VITE_AUTH_PROFILE_SIGNING_SECRET:"do-not-print"}).ready,false);
  assert.equal(inspectSecurityConfig({...good,NAVER_LOGIN_CLIENT_ID:"client"}).ready,false);
  assert.equal(inspectSecurityConfig({...good,VITE_KAKAO_MAP_APP_KEY:"public-key"}).ready,true);
});
test("preflight never combines credentials from different Redis aliases",()=>{
  assert.equal(inspectSecurityConfig({
    KV_REST_API_URL:good.KV_REST_API_URL,
    UPSTASH_REDIS_REST_TOKEN:good.KV_REST_API_TOKEN,
    ADMIN_USER_IDS:good.ADMIN_USER_IDS,
  }).ready,false);
});
test("preflight requires a registered preview OAuth origin",()=>{
  const preview={...good,VERCEL_ENV:"preview",VERCEL_URL:"feature-preview.vercel.app"};
  assert.equal(inspectSecurityConfig(preview).ready,false);
  assert.equal(inspectSecurityConfig({...preview,VITE_PUBLIC_APP_URL:"https://matpick.co.kr"}).ready,false);
  assert.equal(inspectSecurityConfig({...preview,VITE_PUBLIC_APP_URL:"https://feature-preview.vercel.app"}).ready,true);
  assert.equal(inspectSecurityConfig({...preview,OAUTH_PUBLIC_ORIGIN:"https://oauth-preview.example.com"}).ready,true);
  assert.equal(inspectSecurityConfig({...preview,OAUTH_PUBLIC_ORIGIN:"https://matpick.co.kr"}).ready,false);
  assert.equal(inspectSecurityConfig({...preview,OAUTH_PUBLIC_ORIGIN:"http://oauth-preview.example.com"}).ready,false);
});
