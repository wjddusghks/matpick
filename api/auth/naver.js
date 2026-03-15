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

  const clientId =
    process.env.NAVER_LOGIN_CLIENT_ID || process.env.VITE_NAVER_LOGIN_CLIENT_ID;
  const clientSecret = process.env.NAVER_LOGIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({
      error: "네이버 로그인 키 또는 시크릿이 설정되지 않았습니다.",
    });
  }

  try {
    const { code, state } = readBody(req);

    if (!code || !state) {
      return res.status(400).json({
        error: "네이버 로그인 요청 정보가 올바르지 않습니다.",
      });
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      code,
      state,
    });

    const tokenResponse = await fetch(
      `https://nid.naver.com/oauth2.0/token?${tokenParams.toString()}`,
      {
        method: "GET",
      }
    );

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.status(502).json({
        error:
          tokenPayload.error_description ||
          "네이버 토큰 교환에 실패했습니다.",
      });
    }

    const userResponse = await fetch("https://openapi.naver.com/v1/nid/me", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
      },
    });

    const userPayload = await userResponse.json();
    if (!userResponse.ok || userPayload.resultcode !== "00") {
      return res.status(502).json({
        error: userPayload.message || "네이버 사용자 정보를 가져오지 못했습니다.",
      });
    }

    const profile = userPayload.response || {};

    return res.status(200).json({
      user: {
        id: `naver_${String(profile.id || "")}`,
        name: profile.name || profile.nickname || "네이버 사용자",
        email: profile.email || "",
        profileImage: profile.profile_image || "",
        provider: "naver",
      },
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "네이버 로그인 처리 중 문제가 발생했습니다.",
    });
  }
};
