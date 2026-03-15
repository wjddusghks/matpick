const AUTH_PROFILE_STORAGE_KEY = "matpick_auth_profiles";

export interface StoredAuthProfile {
  nickname: string;
  consentAcceptedAt: number;
  allowLocationPersonalization: boolean;
}

type UserLike = {
  id: string;
  name: string;
  nickname?: string;
  consentAcceptedAt?: number;
  allowLocationPersonalization?: boolean;
};

type StoredAuthProfileMap = Record<string, StoredAuthProfile>;

function isBrowser() {
  return typeof window !== "undefined";
}

function readStoredProfiles(): StoredAuthProfileMap {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(AUTH_PROFILE_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredAuthProfileMap) : {};
  } catch {
    return {};
  }
}

function persistStoredProfiles(profiles: StoredAuthProfileMap) {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(AUTH_PROFILE_STORAGE_KEY, JSON.stringify(profiles));
}

export function sanitizeNickname(value: string) {
  return value.replace(/\s+/g, "").slice(0, 6);
}

export function getDisplayName(user: Pick<UserLike, "name" | "nickname"> | null | undefined) {
  return user?.nickname?.trim() || user?.name?.trim() || "사용자";
}

export function hasCompletedProfile(
  user: Pick<UserLike, "nickname" | "consentAcceptedAt"> | null | undefined
) {
  return Boolean(user?.nickname?.trim() && user?.consentAcceptedAt);
}

export function readStoredAuthProfile(userId: string) {
  const profiles = readStoredProfiles();
  return profiles[userId] ?? null;
}

export function saveStoredAuthProfile(userId: string, profile: StoredAuthProfile) {
  const profiles = readStoredProfiles();
  profiles[userId] = profile;
  persistStoredProfiles(profiles);
}

export function mergeUserProfile<T extends UserLike>(user: T): T {
  const profile = readStoredAuthProfile(user.id);
  if (!profile) {
    return user;
  }

  return {
    ...user,
    ...profile,
  };
}
