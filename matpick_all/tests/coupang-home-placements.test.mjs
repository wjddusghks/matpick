import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readSource = path => readFile(new URL(path, import.meta.url), "utf8");

test("homepage uses the verified food banner and affiliate destination", async () => {
  const [config, homeAd, home] = await Promise.all([
    readSource("../client/src/lib/adConfig.ts"),
    readSource("../client/src/components/monetization/HomeAdsense.tsx"),
    readSource("../client/src/pages/Home.tsx"),
  ]);

  assert.match(config, /HOME_COUPANG_DYNAMIC_BANNER_ID = "1037680"/);
  assert.match(config, /HOME_COUPANG_TRACKING_CODE = "AF3438019"/);
  assert.match(config, /https:\/\/link\.coupang\.com\/a\/hJku3MqdCS/);
  assert.match(homeAd, /useIframe/);
  assert.match(homeAd, /로켓프레시에서 장보기/);
  assert.match(homeAd, /Shop on Rocket Fresh/);
  assert.equal((home.match(/<HomeAdsense placement=/g) ?? []).length, 3);
});

test("affiliate CTAs are sponsored and excluded from duplicate document tracking", async () => {
  const [slot, tracker] = await Promise.all([
    readSource("../client/src/components/monetization/MonetizationSlot.tsx"),
    readSource("../client/src/components/AnalyticsTracker.tsx"),
  ]);

  assert.match(slot, /rel="noopener noreferrer sponsored"/);
  assert.match(slot, /data-analytics-click-handled="true"/);
  assert.match(tracker, /data-analytics-click-handled='true'/);
  assert.doesNotMatch(slot, /<span className=\{ctaClasses\}>/);
  assert.match(slot, /new IntersectionObserver/);
  assert.match(slot, /iframeImpressionTrackedRef/);
});

test("homepage keeps publisher verification but does not load the AdSense SDK", async () => {
  const scripts = await readSource(
    "../client/src/components/monetization/MonetizationScripts.tsx"
  );

  const verification = scripts.indexOf('upsertMeta("google-adsense-account"');
  const homeGuard = scripts.indexOf('if (location === "/")');
  const sdk = scripts.indexOf("pagead2.googlesyndication.com");
  assert.ok(verification >= 0 && homeGuard > verification && sdk > homeGuard);
});
