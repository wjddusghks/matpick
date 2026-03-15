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
    process.env.KAKAO_REST_API_KEY || process.env.VITE_KAKAO_REST_API_KEY;
  const clientSecret = process.env.KAKAO_CLIENT_SECRET || "";

  if (!clientId) {
    return res.status(500).json({
      error: "Kakao REST API 키가 설정되지 않았습니다.",
    });
  }

  try {
    const { code, redirectUri } = readBody(req);

    if (!code || !redirectUri) {
      return res.status(400).json({
        error: "카카오 로그인 요청 정보가 올바르지 않습니다.",
      });
    }

    const tokenParams = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code,
    });

    if (clientSecret) {
      tokenParams.set("client_secret", clientSecret);
    }

    const tokenResponse = await fetch("https://kauth.kakao.com/oauth/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
      body: tokenParams,
    });

    const tokenPayload = await tokenResponse.json();
    if (!tokenResponse.ok || !tokenPayload.access_token) {
      return res.status(502).json({
        error:
          tokenPayload.error_description ||
          "카카오 토큰 교환에 실패했습니다.",
      });
    }

    const userResponse = await fetch("https://kapi.kakao.com/v2/user/me", {
      headers: {
        Authorization: `Bearer ${tokenPayload.access_token}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=utf-8",
      },
    });

    const userPayload = await userResponse.json();
    if (!userResponse.ok || !userPayload.id) {
      return res.status(502).json({
        error: userPayload.msg || "카카오 사용자 정보를 가져오지 못했습니다.",
      });
    }

    const account = userPayload.kakao_account || {};
    const profile = account.profile || {};

    return res.status(200).json({
      user: {
        id: `kakao_${String(userPayload.id)}`,
        name: profile.nickname || account.name || "카카오 사용자",
        email: account.email || "",
        profileImage:
          profile.profile_image_url || profile.thumbnail_image_url || "",
        provider: "kakao",
      },
    });
  } catch (error) {
    return res.status(500).json({
      error:
        error instanceof Error
          ? error.message
          : "카카오 로그인 처리 중 문제가 발생했습니다.",
    });
  }
};
