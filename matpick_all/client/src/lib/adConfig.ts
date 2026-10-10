import defaults from "@/data/adsense.json";

// AdSense publisher and slot IDs are public identifiers from the ad snippet.
export const adsenseClient =
  import.meta.env.VITE_ADSENSE_CLIENT?.trim() || defaults.client;
export const homeAdSlots = {
  discovery:
    import.meta.env.VITE_ADSENSE_SLOT_HOME_DISCOVERY?.trim() ||
    defaults.homeDiscovery,
  topics:
    import.meta.env.VITE_ADSENSE_SLOT_HOME_TOPICS?.trim() ||
    defaults.homeTopics,
};

export type HomeCoupangPlacement = "discovery" | "suggestion" | "topics";

const HOME_COUPANG_DYNAMIC_BANNER_ID = "1037680";
const HOME_COUPANG_TRACKING_CODE = "AF3438019";
const HOME_COUPANG_PARTNERS_URL = "https://link.coupang.com/a/hJku3MqdCS";

// These are public identifiers from the verified food-category Coupang Partners banner.
// Dedicated home variables keep the homepage from inheriting an unrelated generic banner.
export const homeCoupangBanner = {
  link:
    import.meta.env.VITE_COUPANG_HOME_PARTNERS_URL?.trim() ||
    HOME_COUPANG_PARTNERS_URL,
  id:
    import.meta.env.VITE_COUPANG_HOME_DYNAMIC_BANNER_ID?.trim() ||
    HOME_COUPANG_DYNAMIC_BANNER_ID,
  trackingCode:
    import.meta.env.VITE_COUPANG_HOME_DYNAMIC_BANNER_TRACKING_CODE?.trim() ||
    HOME_COUPANG_TRACKING_CODE,
  template:
    import.meta.env.VITE_COUPANG_HOME_DYNAMIC_BANNER_TEMPLATE?.trim() ||
    "carousel",
  width: import.meta.env.VITE_COUPANG_HOME_DYNAMIC_BANNER_WIDTH?.trim() || "680",
  height: import.meta.env.VITE_COUPANG_HOME_DYNAMIC_BANNER_HEIGHT?.trim() || "140",
};

export function isAdsenseLiveHost() {
  return (
    typeof window !== "undefined" &&
    ["matpick.co.kr", "www.matpick.co.kr"].includes(window.location.hostname)
  );
}
