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

export function isAdsenseLiveHost() {
  return (
    typeof window !== "undefined" &&
    ["matpick.co.kr", "www.matpick.co.kr"].includes(window.location.hostname)
  );
}
