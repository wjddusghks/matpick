const crypto = require("node:crypto");
const { readRemoteProfile, validateProfileSyncToken } = require("../auth/_profileStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");
const { appendPostComment, readPostComments, readPosts } = require("./_communityStore");

function readBody(req) {
  if (!req.body) return {};
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

function publicComment(comment) {
  const { userId: _userId, ...safeComment } = comment;
  return safeComment;
}

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method === "GET") {
    try {
      if (!(await enforceRateLimit(req, res, {
        bucket: "community:comments:get:ip",
        subject: getClientIp(req),
        limit: 120,
        windowSec: 60,
        message: "Too many comment requests.",
      }))) return;

      const postId = String(req.query?.postId || "").trim();
      if (!postId) return res.status(400).json({ error: "postId가 필요합니다." });
      const comments = (await readPostComments(postId))
        .filter((comment) => comment.status === "published")
        .map(publicComment);
      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=5");
      return res.status(200).json({ comments });
    } catch (error) {
      return res.status(500).json({ error: "댓글을 불러오지 못했습니다." });
    }
  }

  if (req.method === "POST") {
    try {
      if (!enforceSameOrigin(req, res)) return;
      const { postId, userId, syncToken, authorName, body } = readBody(req);
      const cleanBody = typeof body === "string" ? body.trim() : "";
      if (!postId || !userId || !cleanBody || cleanBody.length > 1000) {
        return res.status(400).json({ error: "댓글 내용을 확인해 주세요." });
      }

      if (!(await enforceRateLimit(req, res, {
        bucket: "community:comments:post:user",
        subject: String(userId),
        limit: 20,
        windowSec: 600,
        message: "댓글을 너무 빠르게 등록하고 있습니다.",
      }))) return;

      const tokenValidation = validateProfileSyncToken(userId, syncToken);
      if (!tokenValidation.valid) {
        return res.status(401).json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." });
      }

      const postExists = (await readPosts()).some(
        (post) => post.id === String(postId) && post.status === "published"
      );
      if (!postExists) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });

      const profile = await readRemoteProfile(String(userId));
      const comment = await appendPostComment(String(postId), {
        id: crypto.randomUUID(),
        postId: String(postId),
        userId: String(userId),
        authorName: profile?.nickname || String(authorName || "맛픽 회원"),
        body: cleanBody,
        status: "published",
        createdAt: Date.now(),
      });
      return res.status(201).json({ ok: true, comment: publicComment(comment) });
    } catch (error) {
      return res.status(500).json({ error: "댓글을 저장하지 못했습니다." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
