// Read-only configuration checks. Never prints secret values or Redis responses.
// Optional --ping issues PING only; it does not create or alter data.
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
function redisPair(env) {
  const pairs = [
    [env.KV_REST_API_URL, env.KV_REST_API_TOKEN],
    [env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN],
  ].map(pair => pair.map(value => String(value || "").trim()));
  if (pairs.some(([url, token]) => Boolean(url) !== Boolean(token))) return ["", ""];
  return pairs.find(([url, token]) => url && token) || ["", ""];
}
function httpsOrigin(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:" && !url.username && !url.password &&
      !url.search && !url.hash && url.pathname === "/" ? url.origin : "";
  } catch {
    return "";
  }
}
function previewOAuthOrigin(env) {
  if (env.VERCEL_ENV !== "preview") return true;
  const explicitValue = String(env.OAUTH_PUBLIC_ORIGIN || "").trim();
  if (explicitValue) {
    const explicit = httpsOrigin(explicitValue);
    return Boolean(explicit) && ![
      "https://matpick.co.kr",
      "https://www.matpick.co.kr",
    ].includes(explicit);
  }
  const legacy = httpsOrigin(env.VITE_PUBLIC_APP_URL);
  if (!legacy) return false;
  const host = new URL(legacy).host.toLowerCase();
  return [env.VERCEL_URL, env.VERCEL_BRANCH_URL]
    .filter(value => value && /^[a-z0-9.-]+\.vercel\.app$/i.test(value))
    .some(value => value.toLowerCase() === host);
}
export function inspectSecurityConfig(env) {
  const checks = [];
  const add = (name, ok, reason) => checks.push({ name, status: ok ? "pass" : "fail", ...(ok ? {} : { reason }) });
  const [url, token] = redisPair(env);
  let safeUrl = false;
  try { const u = new URL(url); safeUrl = u.protocol === "https:" && !u.username && !u.password && !u.search && !u.hash; } catch {}
  add("redis-https-endpoint", safeUrl, "Redis HTTPS endpoint is missing or invalid.");
  add("redis-write-credential", Boolean(token), "Server Redis write credential is missing.");
  add("server-admin-allowlist", Boolean(env.ADMIN_USER_IDS?.trim()), "Set server-only ADMIN_USER_IDS; a VITE_ fallback is not sufficient.");
  if (String(env.OAUTH_PUBLIC_ORIGIN || "").trim()) {
    add("oauth-public-origin", Boolean(httpsOrigin(env.OAUTH_PUBLIC_ORIGIN)), "OAUTH_PUBLIC_ORIGIN must be an HTTPS origin without a path, credentials, query, or fragment.");
  }
  if (env.VERCEL_ENV === "preview") {
    add("preview-oauth-origin", previewOAuthOrigin(env), "Set Preview OAUTH_PUBLIC_ORIGIN to the registered HTTPS preview origin. VITE_PUBLIC_APP_URL is accepted only when it matches a platform preview host.");
  }
  const exposed = Object.keys(env).filter(k => k.startsWith("VITE_") &&
    /(?:SECRET|PRIVATE_KEY|PASSWORD|REDIS.*TOKEN|KV_REST_API_TOKEN|ACCESS_TOKEN|SIGNING)/i.test(k) && env[k]);
  add("no-client-exposed-secrets", exposed.length === 0, "Potential server secrets use client-exposed VITE_ variable names.");
  const providers = ["NAVER", "KAKAO"];
  for (const p of providers) {
    const enabled = env[`${p}_LOGIN_CLIENT_ID`] || env[`VITE_${p}_LOGIN_CLIENT_ID`];
    if (enabled && p === "NAVER") add("naver-server-secret", Boolean(env.NAVER_LOGIN_CLIENT_SECRET), "Naver login server secret is missing.");
  }
  return { checkedAt: new Date().toISOString(), ready: checks.every(c => c.status === "pass"), checks, redisPing: "not-requested" };
}
async function main() {
  const args = process.argv.slice(2);
  const allowed = new Set(["--ping", "--output"]);
  for (let i = 0; i < args.length; i++) {
    if (!allowed.has(args[i])) throw new Error("Use --ping and/or --output <path> only.");
    if (args[i] === "--output") { if (!args[++i]) throw new Error("Output path required."); }
  }
  const report = inspectSecurityConfig(process.env);
  if (args.includes("--ping")) {
    if (report.checks.slice(0, 2).some(c => c.status !== "pass")) report.redisPing = "blocked-invalid-config";
    else {
      try {
        const [url, token] = redisPair(process.env);
        const response = await fetch(url, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(["PING"]), signal: AbortSignal.timeout(5000), redirect: "error",
        });
        const payload = response.ok ? await response.json() : null;
        report.redisPing = payload?.result === "PONG" && !payload.error ? "pass" : "fail";
      } catch { report.redisPing = "fail"; }
    }
    report.ready &&= report.redisPing === "pass";
  }
  const serialized = JSON.stringify(report, null, 2);
  const outputIndex = args.indexOf("--output");
  if (outputIndex >= 0) await writeFile(args[outputIndex + 1], serialized + "\n", "utf8");
  console.log(serialized);
  if (!report.ready) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Security preflight could not complete. No secret values were logged."); process.exitCode = 1; });
}
