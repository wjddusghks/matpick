import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { checkRateLimit, enforceRateLimit, enforceRateLimits, getClientIp } = require("../../api/_rateLimit.js");
function env(t, patch) {
  const keys = ["NODE_ENV", "VERCEL", "KV_REST_API_URL", "KV_REST_API_TOKEN", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"];
  const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  Object.assign(process.env, patch);
  t.after(() => { for (const k of keys) saved[k] === undefined ? delete process.env[k] : process.env[k] = saved[k]; });
}
const response = () => ({ headers: {}, setHeader(k,v){this.headers[k]=v;}, status(n){this.statusCode=n;return this;}, json(v){this.body=v;return this;} });
test("deployed missing Redis never falls back to a fresh process counter", async t => {
  env(t,{VERCEL:"1"});
  await assert.rejects(checkRateLimit({bucket:"auth",subject:"test",limit:20}), e=>e.statusCode===503);
  const res=response();
  assert.equal(await enforceRateLimit({headers:{}},res,{bucket:"auth",limit:20}),false);
  assert.equal(res.statusCode,503);
  assert.equal(res.headers["Retry-After"],"60");
});
test("production outside Vercel also fails closed, development still has bounded fallback", async t => {
  env(t,{NODE_ENV:"production"});
  await assert.rejects(checkRateLimit({bucket:"test",subject:"prod"}),e=>e.statusCode===503);
  process.env.NODE_ENV="development";
  assert.equal((await checkRateLimit({bucket:"dev",subject:"local",limit:1})).allowed,true);
  assert.equal((await checkRateLimit({bucket:"dev",subject:"local",limit:1})).allowed,false);
});
test("Redis errors and malformed counts return sanitized 503 for every enforcement wrapper", async t => {
  env(t,{NODE_ENV:"production",KV_REST_API_URL:"https://redis.example",KV_REST_API_TOKEN:"private-token"});
  const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
  for (const result of [{error:"private-token"}, {result:null}, {result:-1}]) {
    globalThis.fetch=async()=>({ok:true,json:async()=>result});
    for (const many of [false,true]) {
      const res=response(),policy={bucket:"read",limit:10};
      const ok=await (many?enforceRateLimits({headers:{}},res,[policy]):enforceRateLimit({headers:{}},res,policy));
      assert.equal(ok,false);assert.equal(res.statusCode,503);
      assert.ok(!JSON.stringify(res).includes("private-token"));
    }
  }
  globalThis.fetch=async()=>{throw new Error("private-token network failure");};
  const res=response();await enforceRateLimit({headers:{}},res,{bucket:"read"});
  assert.equal(res.statusCode,503);assert.ok(!JSON.stringify(res).includes("private-token"));
});
test("insecure or credential-bearing Redis endpoint rejected before fetch",async t=>{
  env(t,{VERCEL:"1",KV_REST_API_TOKEN:"private-token"});
  const old=globalThis.fetch;t.after(()=>globalThis.fetch=old);
  let called=false;globalThis.fetch=async()=>{called=true;};
  for(const url of ["http://redis.example","https://user:pass@redis.example","https://redis.example?token=private-token","bad-url"]){
    process.env.KV_REST_API_URL=url;
    await assert.rejects(checkRateLimit({bucket:"test",subject:"a"}),e=>e.statusCode===503);
  }
  assert.equal(called,false);
});
test("production proxy boundary and equivalent IPv6 identities",t=>{
  env(t,{NODE_ENV:"production"});
  const req={headers:{"x-forwarded-for":"198.51.100.1"},socket:{remoteAddress:"198.51.100.2"}};
  assert.equal(getClientIp(req),"198.51.100.2");
  process.env.VERCEL="1";
  assert.equal(getClientIp(req),"unknown");
  const ip=s=>getClientIp({headers:{"x-vercel-forwarded-for":s}});
  assert.equal(ip("2001:0db8:0000:0000:0000:0000:0000:0001"),ip("2001:db8::1"));
});
