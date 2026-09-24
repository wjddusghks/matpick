const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");
const { authorizeAdminRequest } = require("../admin/_adminAuth");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const {
  validateSuggestion,
  saveSuggestion,
  listSuggestions,
  updateSuggestion,
} = require("./_suggestionStore");

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);
  if (!["GET", "POST", "PATCH"].includes(req.method)) {
    res.setHeader("Allow", "GET, POST, PATCH");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!enforceSameOrigin(req, res)) return;
  if (req.method !== "POST") {
    const auth = authorizeAdminRequest({
      adminKey: req.headers?.["x-matpick-admin-key"],
      syncToken: req.headers?.["x-matpick-admin-token"],
    });
    if (!auth.valid)
      return res.status(403).json({ error: "관리자 로그인이 필요합니다." });
  }
  try {
    if (
      !(await enforceRateLimit(req, res, {
        bucket: `restaurant-suggestions:${req.method}`,
        subject: getClientIp(req),
        limit: req.method === "POST" ? 6 : 60,
        windowSec: req.method === "POST" ? 600 : 60,
        message: "요청이 많아요. 잠시 후 다시 시도해 주세요.",
      }))
    )
      return;
    if (req.method === "GET") {
      const page = Number(req.query?.page || 0);
      if (!Number.isInteger(page) || page < 0 || page > 10000)
        return res.status(400).json({ error: "페이지를 확인해 주세요." });
      return res.status(200).json(await listSuggestions(page));
    }
    const raw =
      typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
    if (Buffer.byteLength(raw) > 24000)
      return res
        .status(413)
        .json({ error: "내용이 너무 길어요. 짧게 정리해 주세요." });
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      return res.status(400).json({ error: "요청 형식을 확인해 주세요." });
    }
    if (req.method === "PATCH") {
      await updateSuggestion(body?.requestId, body?.status);
      return res.status(200).json({ ok: true });
    }
    const receipt = await saveSuggestion(validateSuggestion(body));
    return res.status(200).json({ ok: true, receipt });
  } catch (error) {
    return res
      .status(error.status || 503)
      .json({
        error: error.status
          ? error.message
          : "제보 서비스에 연결하지 못했어요. 작성 내용은 유지되니 다시 시도해 주세요.",
      });
  }
};
