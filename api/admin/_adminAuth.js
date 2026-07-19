const { validateProfileSyncToken } = require("../auth/_profileStore");

function parseAdminList(value) {
  return new Set(
    String(value || "")
      .split(/[,\n]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getConfiguredAdminKeys() {
  const configured = process.env.ADMIN_USER_IDS;
  const developmentFallback =
    process.env.VERCEL_ENV === "production"
      ? ""
      : process.env.VITE_ADMIN_USER_IDS;
  return parseAdminList(configured || developmentFallback);
}

function isAllowedAdminKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) {
    return false;
  }

  return getConfiguredAdminKeys().has(key);
}

function getUserIdFromAdminKey(value) {
  const key = String(value || "").trim();
  const separatorIndex = key.indexOf(":");
  if (separatorIndex < 1 || separatorIndex === key.length - 1) {
    return "";
  }

  return key.slice(separatorIndex + 1);
}

function authorizeAdminRequest({ adminKey, syncToken }) {
  if (!isAllowedAdminKey(adminKey)) {
    return { valid: false, reason: "not-allowlisted" };
  }

  const userId = getUserIdFromAdminKey(adminKey);
  if (!userId) {
    return { valid: false, reason: "invalid-admin-key" };
  }

  const tokenResult = validateProfileSyncToken(userId, syncToken);
  if (!tokenResult.valid) {
    return { valid: false, reason: `invalid-sync-token:${tokenResult.reason}` };
  }

  return { valid: true, reason: "ok", userId };
}

module.exports = {
  authorizeAdminRequest,
  getConfiguredAdminKeys,
  isAllowedAdminKey,
};
