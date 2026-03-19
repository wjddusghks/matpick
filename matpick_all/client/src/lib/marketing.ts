const MARKETING_EVENT_NAME = "matpick:track";

type MarketingEventParams = Record<string, string | number | boolean | null | undefined>;

export type MarketingEventDetail = {
  name: string;
  params?: MarketingEventParams;
};

export function trackMarketingEvent(name: string, params: MarketingEventParams = {}) {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<MarketingEventDetail>(MARKETING_EVENT_NAME, {
      detail: {
        name,
        params,
      },
    })
  );
}

export function getMarketingEventName() {
  return MARKETING_EVENT_NAME;
}
