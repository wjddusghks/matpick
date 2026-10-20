const {
  readSession,
  SessionStoreUnavailableError,
} = require("../auth/_sessionStore");

function parseAdminList(value) {
  return new Set(
    String(value || "")
      .split(/[,\n]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function getConfiguredAdminKeys() {
  return parseAdminList(process.env.ADMIN_USER_IDS);
}

function isAllowedAdminKey(value) {
  const key = String(value || "")
    .trim()
    .toLowerCase();
  if (!key) {
    return false;
  }

  return getConfiguredAdminKeys().has(key);
}

async function authorizeAdminRequest(req) {
  try {
    const session = await readSession(req);
    if (!session) return { valid: false, reason: "missing-session" };
    const adminKey = `${session.user.provider}:${session.user.id}`;
    if (!isAllowedAdminKey(adminKey)) {
      return { valid: false, reason: "not-allowlisted" };
    }
    return {
      valid: true,
      reason: "ok",
      userId: session.user.id,
      user: session.user,
    };
  } catch (error) {
    if (error instanceof SessionStoreUnavailableError) {
      return {
        valid: false,
        unavailable: true,
        reason: "session-store-unavailable",
      };
    }
    throw error;
  }
}

module.exports = {
  authorizeAdminRequest,
  getConfiguredAdminKeys,
  isAllowedAdminKey,
};
