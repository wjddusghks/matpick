function parseAdminList(value) {
  return new Set(
    String(value || "")
      .split(/[,\n]/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean)
  );
}

function getConfiguredAdminKeys() {
  return parseAdminList(process.env.ADMIN_USER_IDS || process.env.VITE_ADMIN_USER_IDS);
}

function isAllowedAdminKey(value) {
  const key = String(value || "").trim().toLowerCase();
  if (!key) {
    return false;
  }

  return getConfiguredAdminKeys().has(key);
}

module.exports = {
  getConfiguredAdminKeys,
  isAllowedAdminKey,
};
