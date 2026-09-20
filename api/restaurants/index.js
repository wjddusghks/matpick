const { readEdits } = require("./_restaurantEdits");
const {
  applyApiSecurityHeaders,
  enforceSameOrigin,
} = require("../_requestGuards");

module.exports = async function handler(req, res) {
  applyApiSecurityHeaders(res);
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }
  if (!enforceSameOrigin(req, res)) return;
  try {
    const { edits } = await readEdits();
    // Only public restaurant fields; operator identities and change history stay private.
    return res.status(200).json({ edits });
  } catch {
    return res
      .status(503)
      .json({ error: "식당 수정 정보를 불러오지 못했습니다." });
  }
};
