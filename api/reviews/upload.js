const { isValidProfileSyncToken } = require("../auth/_profileStore");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { handleUpload } = await import("@vercel/blob/client");
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;

    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = clientPayload ? JSON.parse(clientPayload) : {};
        const userId = String(payload.userId || "").trim();
        const syncToken = String(payload.syncToken || "").trim();
        const restaurantId = String(payload.restaurantId || "").trim();

        if (!userId || !restaurantId || !isValidProfileSyncToken(userId, syncToken)) {
          throw new Error("Unauthorized upload request");
        }

        if (!pathname.startsWith(`reviews/${restaurantId}/`)) {
          throw new Error("Invalid upload path");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          maximumSizeInBytes: 4_500_000,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            userId,
            restaurantId,
          }),
        };
      },
      onUploadCompleted: async () => {},
    });

    return res.status(200).json(jsonResponse);
  } catch (error) {
    return res.status(400).json({
      error: error instanceof Error ? error.message : "Failed to upload review photo",
    });
  }
};
