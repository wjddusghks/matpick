import type { StoredAuthProfile } from "./authProfile";

export async function persistRemoteAuthProfile(
  userId: string,
  syncToken: string | undefined,
  profile: StoredAuthProfile
) {
  if (!userId || !syncToken) {
    return false;
  }

  const response = await fetch("/api/auth/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      userId,
      syncToken,
      profile,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to sync the auth profile.");
  }

  return true;
}
