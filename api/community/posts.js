const crypto = require("node:crypto");
const { readRemoteProfile, validateProfileSyncToken } = require("../auth/_profileStore");
const { enforceRateLimit, getClientIp } = require("../_rateLimit");
const { applyApiSecurityHeaders, enforceSameOrigin } = require("../_requestGuards");
const { logSecurityEvent, maskValue } = require("../_securityLog");
const { appendPost, readPosts } = require("./_communityStore");

function readBody(req) {
  if (!req.body) return {};
  return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
}

function publicPost(post) {
  const { userId: _userId, ...safePost } = post;
  return safePost;
}

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);

  if (req.method === "GET") {
    try {
      if (!(await enforceRateLimit(req, res, {
        bucket: "community:posts:get:ip",
        subject: getClientIp(req),
        limit: 120,
        windowSec: 60,
        message: "Too many community requests. Please try again shortly.",
      }))) return;

      const id = String(req.query?.id || "").trim();
      const category = String(req.query?.category || "").trim();
      const query = String(req.query?.query || "").trim().toLocaleLowerCase("ko-KR");
      const limit = Math.min(Math.max(Number(req.query?.limit) || 40, 1), 100);
      const posts = (await readPosts()).filter((post) => post.status === "published");

      if (id) {
        const post = posts.find((item) => item.id === id);
        if (!post) return res.status(404).json({ error: "게시글을 찾을 수 없습니다." });
        res.setHeader("Cache-Control", "public, max-age=0, s-maxage=10");
        return res.status(200).json({ post: publicPost(post) });
      }

      const filtered = posts
        .filter((post) => !category || category === "all" || post.category === category)
        .filter((post) => {
          if (!query) return true;
          return [post.title, post.body, post.authorName, ...post.placeTags.map((tag) => tag.name)]
            .join(" ")
            .toLocaleLowerCase("ko-KR")
            .includes(query);
        })
        .slice(0, limit)
        .map(publicPost);

      res.setHeader("Cache-Control", "public, max-age=0, s-maxage=10");
      return res.status(200).json({ posts: filtered });
    } catch (error) {
      return res.status(500).json({
        error: error instanceof Error ? error.message : "게시글을 불러오지 못했습니다.",
      });
    }
  }

  if (req.method === "POST") {
    try {
      if (!enforceSameOrigin(req, res)) return;
      const { userId, syncToken, authorName, title, body, category, placeTags } = readBody(req);

      if (!(await enforceRateLimit(req, res, {
        bucket: "community:posts:post:ip",
        subject: getClientIp(req),
        limit: 12,
        windowSec: 600,
        message: "게시글을 너무 빠르게 등록하고 있습니다. 잠시 후 다시 시도해 주세요.",
      }))) return;

      const cleanTitle = typeof title === "string" ? title.trim() : "";
      const cleanBody = typeof body === "string" ? body.trim() : "";
      if (!userId || cleanTitle.length < 2 || cleanTitle.length > 100 || cleanBody.length < 5 || cleanBody.length > 5000) {
        return res.status(400).json({ error: "제목과 내용을 확인해 주세요." });
      }

      if (!(await enforceRateLimit(req, res, {
        bucket: "community:posts:post:user",
        subject: String(userId),
        limit: 8,
        windowSec: 600,
        message: "등록 가능한 게시글 수를 초과했습니다. 잠시 후 다시 시도해 주세요.",
      }))) return;

      const tokenValidation = validateProfileSyncToken(userId, syncToken);
      if (!tokenValidation.valid) {
        logSecurityEvent("warn", "community-post-token-rejected", {
          userId: maskValue(userId),
          ip: maskValue(getClientIp(req)),
          reason: tokenValidation.reason,
        });
        return res.status(401).json({ error: "로그인이 만료되었습니다. 다시 로그인해 주세요." });
      }

      const profile = await readRemoteProfile(String(userId));
      const post = await appendPost({
        id: crypto.randomUUID(),
        userId: String(userId),
        authorName: profile?.nickname || String(authorName || "맛픽 회원"),
        title: cleanTitle,
        body: cleanBody,
        category,
        placeTags,
        commentCount: 0,
        status: "published",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      return res.status(201).json({ ok: true, post: publicPost(post) });
    } catch (error) {
      logSecurityEvent("error", "community-post-save-failed", {
        ip: maskValue(getClientIp(req)),
        message: error instanceof Error ? error.message : "unknown",
      });
      return res.status(500).json({
        error: error instanceof Error ? error.message : "게시글을 저장하지 못했습니다.",
      });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed" });
};
