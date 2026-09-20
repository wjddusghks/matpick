// Only derive age from the server's OAuth provider response. Never accept client-supplied ages.
const AGE_GROUPS = new Set([
  "20s",
  "30s",
  "40s",
  "50s",
  "60s",
  "70s",
  "80s",
  "90plus",
  "60plus",
]);
const AGE_BASES = new Set(["birth_date", "kakao_range", "naver_range"]);
const MAX_AGE_PROFILE_MS = 30 * 86400000;
function normalizeAgeProfile(value, now = Date.now()) {
  if (
    !value ||
    !AGE_GROUPS.has(value.group) ||
    !AGE_BASES.has(value.basis) ||
    !Number.isFinite(value.checkedAt) ||
    value.checkedAt > now ||
    now - value.checkedAt > MAX_AGE_PROFILE_MS
  )
    return null;
  return { group: value.group, basis: value.basis, checkedAt: value.checkedAt };
}
function deriveAgeProfile(provider, profile, now = Date.now()) {
  if (!["kakao", "naver"].includes(provider) || !profile) return null;
  const today = new Date(now + 9 * 3600000).toISOString().slice(0, 10);
  const [year, month, day] = today.split("-").map(Number);
  const solar = provider === "naver" || profile.birthday_type === "SOLAR";
  const birthday = String(profile.birthday || "").replace("-", "");
  const birthyear = String(profile.birthyear || "");
  if (
    solar &&
    profile.birthyear_needs_agreement !== true &&
    profile.birthday_needs_agreement !== true &&
    /^\d{4}$/.test(birthyear) &&
    /^\d{4}$/.test(birthday)
  ) {
    const by = Number(birthyear),
      bm = Number(birthday.slice(0, 2)),
      bd = Number(birthday.slice(2));
    const birth = new Date(Date.UTC(by, bm - 1, bd));
    if (
      birth.getUTCFullYear() === by &&
      birth.getUTCMonth() === bm - 1 &&
      birth.getUTCDate() === bd
    ) {
      const age =
        year - by - (month < bm || (month === bm && day < bd) ? 1 : 0);
      if (age >= 20 && age <= 120)
        return {
          group: age >= 90 ? "90plus" : `${Math.floor(age / 10) * 10}s`,
          basis: "birth_date",
          checkedAt: now,
        };
      return null;
    }
  }
  if (
    provider === "kakao" &&
    (profile.age_range_needs_agreement === true ||
      profile.has_age_range === false ||
      profile.is_age_range_valid === false)
  )
    return null;
  const range = String(
    provider === "kakao" ? profile.age_range || "" : profile.age || "",
  ).trim();
  if (provider === "naver" && range === "60-")
    return { group: "60plus", basis: "naver_range", checkedAt: now };
  const match = range.match(
    /^(20|30|40|50|60|70|80)[~-](29|39|49|59|69|79|89)$/,
  );
  if (match && Number(match[2]) === Number(match[1]) + 9)
    return {
      group: `${match[1]}s`,
      basis: `${provider}_range`,
      checkedAt: now,
    };
  if (range === "90~" || range === "90-")
    return { group: "90plus", basis: `${provider}_range`, checkedAt: now };
  // Missing/estimated/minor/ambiguous ranges are never guessed or exposed.
  return null;
}
function publicReviewAge(review) {
  if (
    review?.ageConsentVersion !== "review-age-v1" ||
    !AGE_GROUPS.has(review.ageGroup) ||
    !AGE_BASES.has(review.ageBasis) ||
    !Number.isFinite(review.ageCheckedAt) ||
    !Number.isFinite(review.ageConsentAt) ||
    review.ageCheckedAt > review.ageConsentAt ||
    review.ageConsentAt - review.ageCheckedAt > MAX_AGE_PROFILE_MS
  )
    return {};
  return {
    ageGroup: review.ageGroup,
    ageBasis: review.ageBasis,
    ageCheckedAt: review.ageCheckedAt,
    ageConsentAt: review.ageConsentAt,
    ageConsentVersion: "review-age-v1",
  };
}
module.exports = { deriveAgeProfile, normalizeAgeProfile, publicReviewAge };
