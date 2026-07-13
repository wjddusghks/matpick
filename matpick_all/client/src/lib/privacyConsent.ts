export const PRIVACY_PREFERENCES_KEY = "matpick_privacy_preferences_v1";
export const PRIVACY_PREFERENCES_EVENT = "matpick:privacy-preferences-changed";
export const PRIVACY_SETTINGS_OPEN_EVENT = "matpick:privacy-settings-open";

export type PrivacyPreferences = {
  version: 1;
  analytics: boolean;
  advertising: boolean;
  updatedAt: number;
};

export function readPrivacyPreferences(): PrivacyPreferences | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(PRIVACY_PREFERENCES_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<PrivacyPreferences>;
    if (parsed.version !== 1) {
      return null;
    }

    return {
      version: 1,
      analytics: parsed.analytics === true,
      advertising: parsed.advertising === true,
      updatedAt: Number(parsed.updatedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function savePrivacyPreferences(
  values: Pick<PrivacyPreferences, "analytics" | "advertising">
) {
  if (typeof window === "undefined") {
    return;
  }

  const preferences: PrivacyPreferences = {
    version: 1,
    analytics: values.analytics,
    advertising: values.advertising,
    updatedAt: Date.now(),
  };

  try {
    window.localStorage.setItem(PRIVACY_PREFERENCES_KEY, JSON.stringify(preferences));
  } catch {
    // The choice still applies to this page through the dispatched event.
  }

  window.dispatchEvent(
    new CustomEvent<PrivacyPreferences>(PRIVACY_PREFERENCES_EVENT, {
      detail: preferences,
    })
  );
}

export function hasAnalyticsConsent() {
  return readPrivacyPreferences()?.analytics === true;
}

export function hasAdvertisingConsent() {
  return readPrivacyPreferences()?.advertising === true;
}

export function openPrivacySettings() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PRIVACY_SETTINGS_OPEN_EVENT));
  }
}
