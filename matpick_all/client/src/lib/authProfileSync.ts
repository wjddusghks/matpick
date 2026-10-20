import type { StoredAuthProfile } from "./authProfile";

export async function persistRemoteAuthProfile(profile: StoredAuthProfile) {
  const response = await fetch("/api/auth/profile", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "same-origin",
    body: JSON.stringify({ profile }),
  });

  if (!response.ok) {
    throw new Error("Failed to sync the auth profile.");
  }

  return true;
}
