import type { User } from "@/contexts/AuthContext";

function parseAdminList(value: string | undefined) {
  return new Set(
    (value ?? "")
      .split(/[,\n]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

const adminUserIds = parseAdminList(import.meta.env.VITE_ADMIN_USER_IDS);

export function getAdminRegistrationKey(user: Pick<User, "id" | "provider">) {
  return `${user.provider}:${user.id}`;
}

export function getAdminIdentityCandidates(user: User) {
  return [getAdminRegistrationKey(user).toLowerCase()];
}

export function hasAdminConfiguration() {
  return adminUserIds.size > 0;
}

export function isAdminUser(user: User | null | undefined) {
  if (!user) {
    return false;
  }

  const candidates = getAdminIdentityCandidates(user);
  return candidates.some((candidate) => adminUserIds.has(candidate));
}
