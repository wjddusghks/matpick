const crypto = require("node:crypto");

function createMemberReview({
  restaurantId,
  userId,
  profile,
  review,
  now = Date.now(),
}) {
  const text = typeof review?.text === "string" ? review.text.trim() : "";
  if (
    !/^[\w-]{1,160}$/.test(restaurantId) ||
    !userId ||
    !profile?.nickname ||
    !profile?.consentAcceptedAt
  ) {
    throw Object.assign(
      new Error("회원 정보를 확인한 뒤 다시 로그인해 주세요."),
      { status: 401 },
    );
  }
  if (
    !Number.isInteger(review?.stars) ||
    review.stars < 1 ||
    review.stars > 5 ||
    text.length < 5 ||
    text.length > 2000 ||
    review.visited !== true
  ) {
    throw Object.assign(
      new Error("별점, 5자 이상의 후기와 직접 방문 여부를 확인해 주세요."),
      { status: 400 },
    );
  }
  // One account has one current review per restaurant. Provider IDs never become public.
  const id = `member-${crypto
    .createHash("sha256")
    .update(JSON.stringify([String(userId), restaurantId]))
    .digest("hex")
    .slice(0, 32)}`;
  return {
    id,
    user: profile.nickname,
    date: new Date(now)
      .toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" })
      .replace(/-/g, "."),
    stars: review.stars,
    text,
    photos: [],
    createdAt: now,
  };
}

module.exports = { createMemberReview };
