const { validateProfileSyncToken } = require("../auth/_profileStore");
const { checkRateLimit, enforceRateLimit, getClientIp } = require("../_rateLimit");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!enforceSameOrigin(req, res)) {
    return;
  }

  try {
    if (
      !(await enforceRateLimit(req, res, {
        bucket: "reviews:upload:ip",
        subject: getClientIp(req),
        limit: 20,
        windowSec: 600,
        message: "Too many photo upload requests. Please try again later.",
      }))
    ) {
      return;
    }

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

        const userRateLimit = await checkRateLimit({
          bucket: "reviews:upload:user",
          subject: userId || getClientIp(req),
          limit: 12,
          windowSec: 600,
        });

        if (!userRateLimit.allowed) {
          throw new Error("Too many upload attempts");
        }

        const tokenValidation = validateProfileSyncToken(userId, syncToken);

        if (!userId || !restaurantId || !tokenValidation.valid) {
          logSecurityEvent("warn", "review-upload-token-rejected", {
            route: "/api/reviews/upload",
            userId: maskValue(userId),
            restaurantId: maskValue(restaurantId),
            ip: maskValue(getClientIp(req)),
            version: tokenValidation.version,
            reason: tokenValidation.reason,
          });
          throw new Error("Your session expired. Please sign in again before uploading review photos.");
        }

        if (tokenValidation.version === "legacy") {
          logSecurityEvent("warn", "legacy-sync-token-used", {
            route: "/api/reviews/upload",
            userId: maskValue(userId),
            restaurantId: maskValue(restaurantId),
            ip: maskValue(getClientIp(req)),
          });
          res.setHeader("X-Matpick-Legacy-Token", "1");
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
    const message =
      error instanceof Error ? error.message : "Failed to upload review photo";
    const status = /too many upload/i.test(message) ? 429 : 400;

    if (status >= 400 && status !== 429) {
      logSecurityEvent("warn", "review-upload-failed", {
        route: "/api/reviews/upload",
        ip: maskValue(getClientIp(req)),
        message,
      });
    }

    return res.status(status).json({
      error: message,
    });
  }
};
