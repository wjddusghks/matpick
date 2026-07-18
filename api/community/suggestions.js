const crypto = require("node:crypto");
const { readRemoteProfile, validateProfileSyncToken } = require("../auth/_profileStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");
const { appendSuggestion, readSuggestions } = require("./_communityStore");

function readBody(req) {
  if (!req.body) return {};
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

function publicSuggestion(suggestion, includeOwner = false) {
  const { userId, ...safeSuggestion } = suggestion;
  return includeOwner ? { ...safeSuggestion, isOwner: true } : safeSuggestion;
}

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method === "GET") {
    try {
      if (!(await enforceRateLimit(req, res, {
        bucket: "community:suggestions:get:ip",
        subject: getClientIp(req),
        limit: 120,
        windowSec: 60,
        message: "Too many suggestion requests.",
      }))) return;

      const mine = String(req.query?.mine || "") === "1";
      const limit = Math.min(Math.max(Number(req.query?.limit) || 40, 1), 100);
      let suggestions = await readSuggestions();

      if (mine) {
        const userId = String(req.headers["x-matpick-user-id"] || "").trim();
        const syncToken = String(req.headers["x-matpick-sync-token"] || "").trim();
        if (!validateProfileSyncToken(userId, syncToken).valid) {
          return res.status(401).json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." });
        }
        suggestions = suggestions.filter((item) => item.userId === userId);
        return res.status(200).json({
          suggestions: suggestions.slice(0, limit).map((item) => publicSuggestion(item, true)),
        });
      }

      return res.status(200).json({
        suggestions: suggestions
          .filter((item) => item.status !== "rejected")
          .slice(0, limit)
          .map((item) => publicSuggestion(item)),
      });
    } catch (error) {
      return res.status(500).json({ error: "추천 식당을 불러오지 못했습니다." });
    }
  }

  if (req.method === "POST") {
    try {
      if (!enforceSameOrigin(req, res)) return;
      const { userId, syncToken, authorName, name, address, region, category, mapUrl, reason } = readBody(req);
      const cleanName = typeof name === "string" ? name.trim() : "";
      const cleanAddress = typeof address === "string" ? address.trim() : "";
      const cleanReason = typeof reason === "string" ? reason.trim() : "";
      if (!userId || cleanName.length < 2 || cleanName.length > 100 || cleanAddress.length < 3 || cleanAddress.length > 240 || cleanReason.length > 1500) {
        return res.status(400).json({ error: "식당명과 주소를 확인해 주세요." });
      }

      if (!(await enforceRateLimit(req, res, {
        bucket: "community:suggestions:post:user",
        subject: String(userId),
        limit: 10,
        windowSec: 3600,
        message: "추천 등록 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.",
      }))) return;

      if (!validateProfileSyncToken(userId, syncToken).valid) {
        return res.status(401).json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." });
      }

      const duplicate = (await readSuggestions()).find(
        (item) => item.name.replace(/\s+/g, "").toLocaleLowerCase("ko-KR") === cleanName.replace(/\s+/g, "").toLocaleLowerCase("ko-KR") &&
          item.address.replace(/\s+/g, "").toLocaleLowerCase("ko-KR") === cleanAddress.replace(/\s+/g, "").toLocaleLowerCase("ko-KR")
      );
      if (duplicate) {
        return res.status(409).json({
          error: "이미 제보된 식당입니다.",
          suggestion: publicSuggestion(duplicate),
        });
      }

      const profile = await readRemoteProfile(String(userId));
      const suggestion = await appendSuggestion({
        id: crypto.randomUUID(),
        userId: String(userId),
        authorName: profile?.nickname || String(authorName || "맛픽 회원"),
        name: cleanName,
        address: cleanAddress,
        region,
        category,
        mapUrl,
        reason: cleanReason,
        status: "pending",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      return res.status(201).json({ ok: true, suggestion: publicSuggestion(suggestion, true) });
    } catch (error) {
      return res.status(500).json({ error: "추천 식당을 저장하지 못했습니다." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
