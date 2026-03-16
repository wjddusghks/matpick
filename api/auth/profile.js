const {
  isValidProfileSyncToken,
  writeRemoteProfile,
} = require("./_profileStore");

function readBody(req) {
  if (!req.body) {
    return {};
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  return req.body;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userId, syncToken, profile } = readBody(req);

    if (!userId || !profile?.nickname || !profile?.consentAcceptedAt) {
      return res.status(400).json({ error: "Invalid profile payload" });
    }

    if (!isValidProfileSyncToken(userId, syncToken)) {
      return res.status(401).json({ error: "Invalid sync token" });
    }

    await writeRemoteProfile(userId, profile);

    return res.status(200).json({ ok: true });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : "Failed to save profile",
    });
  }
};
