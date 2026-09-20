export type AgeGroup =
  | "20s"
  | "30s"
  | "40s"
  | "50s"
  | "60s"
  | "70s"
  | "80s"
  | "90plus"
  | "60plus";
export type AgeProfile = {
  group: AgeGroup;
  basis: "birth_date" | "kakao_range" | "naver_range";
  checkedAt: number;
};
const groups: AgeGroup[] = [
  "20s",
  "30s",
  "40s",
  "50s",
  "60s",
  "70s",
  "80s",
  "90plus",
  "60plus",
];
export function ageGroupLabel(group: unknown, english = false): string {
  if (!groups.includes(group as AgeGroup)) return "";
  const value = String(group);
  return english
    ? value.endsWith("plus")
      ? value.replace("plus", "+")
      : value
    : value.endsWith("plus")
      ? `${value.replace("plus", "")}대 이상`
      : `${value.replace("s", "")}대`;
}
export function ageGroupHint(
  basis: AgeProfile["basis"],
  english = false
): string {
  if (english)
    return basis === "birth_date"
      ? "Age at sign-in, calculated from account birth information."
      : basis === "kakao_range"
        ? "Kakao account age range (Korean age); not identity-verified."
        : "Naver account age range at sign-in; not identity-verified.";
  return basis === "birth_date"
    ? "로그인 때 제공된 생년 정보로 계산한 만 나이 연령대예요. 후기 작성 당시 참고 정보입니다."
    : basis === "kakao_range"
      ? "카카오 계정에서 제공한 연령대(한국 나이 기준)예요. 별도의 나이 본인인증을 뜻하지 않아요."
      : "네이버 계정에서 제공한 연령대예요. 별도의 나이 본인인증을 뜻하지 않아요.";
}
export function currentAgeProfile(
  value: AgeProfile | null | undefined,
  now = Date.now()
): AgeProfile | null {
  return value &&
    ageGroupLabel(value.group) &&
    ["birth_date", "kakao_range", "naver_range"].includes(value.basis) &&
    Number.isFinite(value.checkedAt) &&
    value.checkedAt <= now &&
    now - value.checkedAt <= 30 * 86400000
    ? value
    : null;
}
