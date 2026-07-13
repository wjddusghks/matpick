import type { ReactNode } from "react";
import { Link } from "wouter";
import InfoPageLayout from "@/components/InfoPageLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { openPrivacySettings } from "@/lib/privacyConsent";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

type PolicySection = {
  title: string;
  paragraphs: string[];
  bullets?: string[];
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-[#1f1718]">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-[#5f5556] sm:text-[15px]">
        {children}
      </div>
    </section>
  );
}

const koreanSections: PolicySection[] = [
  {
    title: "1. 처리 주체와 적용 범위",
    paragraphs: [
      "Matpick 운영자(이하 ‘운영자’)는 개인정보 보호법 등 관련 법령에 따라 서비스에서 처리하는 개인정보를 보호합니다. 이 방침은 matpick.co.kr 웹 서비스, 회원 기능, 리뷰와 문의 처리에 적용됩니다.",
      "개인정보 보호 담당 창구는 Instagram @matpick.co.kr DM입니다. 개인정보가 포함된 요청은 공개 GitHub 이슈에 작성하지 말아 주세요.",
    ],
  },
  {
    title: "2. 처리 항목과 이용 목적",
    paragraphs: [
      "운영자는 아래 정보를 서비스 제공에 필요한 범위에서 처리합니다. 선택 항목을 제공하지 않아도 해당 선택 기능을 제외한 기본 탐색은 이용할 수 있습니다.",
    ],
    bullets: [
      "소셜 로그인 및 회원 관리: 로그인 제공자, 제공자가 발급한 이용자 식별값, 이름·닉네임, 제공되는 경우 이메일과 프로필 이미지, 동의 시각 및 선택 설정. 로그인 유지, 계정 식별, 저장·리뷰 기능, 부정 이용 방지에 사용합니다.",
      "이용자 콘텐츠: 리뷰 본문, 평점, 업로드 사진, 작성·수정 시각, 연결된 식당 정보. 리뷰 표시, 수정·삭제 처리와 서비스 품질 관리에 사용합니다.",
      "자동 생성 정보: IP 주소, 브라우저·기기 정보, 요청 시각, 페이지 경로, 검색어, 클릭·광고 상호작용, 무작위 방문자·세션 식별값. 보안, 오류 대응, 이용 통계와 성능 개선에 사용합니다.",
      "위치 정보: 브라우저에서 이용자가 직접 권한을 허용한 경우의 현재 좌표. 주변 식당 정렬과 지도 표시를 위해 현재 세션에서 사용하며, 원칙적으로 회원 프로필에 좌표 자체를 저장하지 않습니다.",
      "브라우저 저장소: 로그인 상태, 즐겨찾기, 최근 이용 상태, 개인정보·쿠키 선택값. 선택한 기능 유지와 사용자 경험 제공에 사용합니다.",
    ],
  },
  {
    title: "3. 수집 방법",
    paragraphs: [
      "소셜 로그인 과정에서 제공자가 전달하는 정보, 이용자가 직접 입력·업로드하는 정보, 서비스 이용 과정에서 브라우저와 서버가 자동 생성하는 정보를 통해 수집합니다. 위치는 브라우저 권한 요청에 이용자가 동의한 경우에만 접근합니다.",
    ],
  },
  {
    title: "4. 보유 및 파기 기간",
    paragraphs: [
      "목적이 달성되면 지체 없이 삭제하거나 복구하기 어려운 방식으로 파기합니다. 다만 관계 법령에 보존 의무가 있거나 분쟁·보안 대응에 필요한 경우 해당 기간 동안 분리 보관할 수 있습니다.",
    ],
    bullets: [
      "회원 프로필과 회원 식별 정보: 회원 탈퇴 또는 삭제 요청 처리 시까지",
      "리뷰와 업로드 사진: 이용자가 삭제하거나 권리 침해·삭제 요청이 처리될 때까지",
      "일자별 익명·가명 이용 통계: 45일",
      "일자별 회원 운영 통계: 180일",
      "개인을 직접 식별하지 않는 누적 집계 통계: 서비스 운영 기간",
      "브라우저의 방문자 식별값과 선택 설정: 이용자가 저장소를 삭제하거나 설정을 변경할 때까지",
      "로그인 동기화 토큰: 발급 후 최대 30일 또는 로그아웃·재로그인 등으로 갱신될 때까지",
    ],
  },
  {
    title: "5. 쿠키, 로컬 저장소와 맞춤형 광고",
    paragraphs: [
      "Matpick은 필수 저장소와 선택형 분석·광고 도구를 구분합니다. Google Analytics·광고 태그와 Meta Pixel, Google AdSense, 카카오 애드핏, 쿠팡 파트너스 광고는 이용자가 분석 또는 광고 사용을 허용한 경우에만 사이트 코드에서 실행됩니다.",
      "이용자는 아래 버튼으로 선택을 언제든 변경할 수 있고, 브라우저 설정에서도 쿠키와 로컬 저장소를 삭제하거나 제3자 쿠키를 차단할 수 있습니다. 필수 저장소를 차단하면 로그인, 즐겨찾기 등 일부 기능이 정상 동작하지 않을 수 있습니다.",
    ],
  },
  {
    title: "6. 외부 서비스와 처리 위탁·연동",
    paragraphs: [
      "서비스 제공을 위해 아래 사업자의 도구를 사용합니다. 각 사업자는 이용자의 요청, 동의 및 자체 정책에 따라 IP 주소, 기기 정보, 쿠키 식별자 또는 로그인 정보를 처리할 수 있습니다.",
    ],
    bullets: [
      "NAVER·Kakao: 소셜 로그인, 지도 또는 공유 기능",
      "NAVER Maps: 지도 화면과 위치 기반 탐색",
      "Google: AdSense, Analytics·Google 태그, 사이트 확인 및 동의 메시지",
      "Kakao AdFit: 광고 제공과 성과 측정",
      "Coupang Partners: 제휴 광고 제공과 제휴 성과 확인",
      "Meta: 이용자가 허용한 경우의 광고·성과 측정",
      "Vercel 및 연결된 Blob/KV 인프라, Upstash: 웹 호스팅, 파일·회원 프로필·집계 데이터 저장, 보안 로그 처리",
    ],
  },
  {
    title: "7. 국외 처리 가능성",
    paragraphs: [
      "Vercel, Google, Meta, Upstash 등 글로벌 사업자의 인프라를 이용하는 과정에서 정보가 대한민국 밖의 서버에서 전송·보관·처리될 수 있습니다. 처리 국가와 센터는 사업자의 인프라 구성에 따라 달라질 수 있으며, 전송은 암호화된 HTTPS 통신으로 이루어집니다. 선택형 분석·광고 처리는 이용자의 허용 이후 시작되고, 보유기간은 이 방침과 각 사업자의 정책에 따릅니다.",
    ],
  },
  {
    title: "8. 이용자의 권리와 행사 방법",
    paragraphs: [
      "이용자는 자신의 개인정보 열람, 정정, 삭제, 처리 정지, 동의 철회 및 회원 탈퇴를 요청할 수 있습니다. 본인 확인이 필요한 요청은 Instagram @matpick.co.kr DM으로 계정 제공자와 닉네임, 요청 내용을 보내 주세요. 운영자는 본인 여부를 확인한 뒤 관련 법령이 정한 범위에서 처리 결과를 안내합니다.",
      "브라우저 위치 권한은 기기 설정에서 철회할 수 있고, 로컬 데이터는 브라우저 저장소 삭제로 제거할 수 있습니다. 광고·분석 설정은 아래 버튼에서 변경할 수 있습니다.",
    ],
  },
  {
    title: "9. 안전성 확보 조치",
    paragraphs: [
      "운영자는 전송 구간 암호화(HTTPS), API 요청 출처 검사, 요청 횟수 제한, 관리자 허용 목록과 서명된 로그인 토큰의 이중 확인, 보안 헤더, 접근 로그 최소화, 이미지 무단 외부 삽입 제한 등 합리적인 기술·관리적 보호조치를 적용합니다. 다만 인터넷 서비스의 위험을 완전히 제거할 수는 없습니다.",
    ],
  },
  {
    title: "10. 아동, 변경 고지와 시행일",
    paragraphs: [
      "Matpick은 만 14세 미만 아동을 대상으로 회원 서비스를 제공하지 않습니다. 만 14세 미만 이용자의 정보가 법정대리인 동의 없이 수집된 사실을 확인하면 지체 없이 삭제합니다.",
      "중요한 변경이 있을 때에는 시행 전에 이 페이지 또는 서비스 화면에서 알립니다. 본 방침의 시행일은 2026년 7월 14일입니다.",
    ],
  },
];

const englishSections: PolicySection[] = [
  {
    title: "1. Controller and scope",
    paragraphs: [
      "The Matpick operator protects personal data under applicable privacy laws. This policy applies to matpick.co.kr, account features, reviews, and support requests.",
      "Privacy requests are handled through Instagram DM at @matpick.co.kr. Never post personal information in a public GitHub issue.",
    ],
  },
  {
    title: "2. Data, purpose, and collection",
    paragraphs: [
      "We process only the information needed to provide the requested service. Data is received from social sign-in providers, entered or uploaded by users, or generated during service use.",
    ],
    bullets: [
      "Accounts: provider, provider-issued user ID, name or nickname, optional email and profile image, consent time, and settings for login, account management, saved places, and abuse prevention.",
      "User content: review text, ratings, photos, timestamps, and restaurant references for publishing and moderation.",
      "Usage and security: IP address, browser or device data, request time, paths, searches, clicks, ad interactions, and random visitor or session IDs for security and aggregated analytics.",
      "Location: current coordinates only after browser permission, used for nearby sorting and maps and not normally stored in the member profile.",
      "Browser storage: login state, favorites, recent state, and privacy choices needed to preserve requested features.",
    ],
  },
  {
    title: "3. Retention",
    paragraphs: [
      "Data is deleted or irreversibly disposed of when its purpose ends, unless law or a dispute requires a longer period.",
    ],
    bullets: [
      "Account profile and identifiers: until account deletion is requested",
      "Reviews and uploaded photos: until deleted or a valid removal request is resolved",
      "Daily pseudonymous analytics: 45 days; daily member operations metrics: 180 days",
      "Non-identifying aggregate totals: while the service operates",
      "Browser identifiers and choices: until storage is cleared or choices are changed",
      "Signed profile sync token: up to 30 days or until it is renewed",
    ],
  },
  {
    title: "4. Cookies and advertising choices",
    paragraphs: [
      "Essential storage is separated from optional analytics and advertising. Google measurement tags, Meta Pixel, Google AdSense, Kakao AdFit, and Coupang Partners run from the site only after the relevant choice is allowed.",
      "You can reopen the settings below at any time or clear browser storage. Blocking essential storage may prevent login or favorites from working.",
    ],
  },
  {
    title: "5. Service providers and international processing",
    paragraphs: [
      "We use NAVER and Kakao for sign-in, maps, or sharing; Google, Kakao AdFit, Coupang Partners, and Meta for consented ads or measurement; and Vercel, Blob/KV infrastructure, and Upstash for hosting and storage.",
      "Global providers may process information outside Korea according to their infrastructure and policies. Transfers use HTTPS, and optional analytics or advertising starts only after permission.",
    ],
  },
  {
    title: "6. Your rights",
    paragraphs: [
      "You may request access, correction, deletion, suspension, consent withdrawal, or account deletion through Instagram @matpick.co.kr. We may verify the account provider and nickname before acting. Location permission can be revoked in the browser, and local data can be removed by clearing site storage.",
    ],
  },
  {
    title: "7. Security, children, and effective date",
    paragraphs: [
      "We use HTTPS, origin checks, rate limits, allowlisted and signed-token admin access, security headers, limited logs, and same-origin image controls. No internet service can eliminate all risk.",
      "Matpick does not target children under 14. This policy is effective July 14, 2026, and material changes will be announced on this page or in the service.",
    ],
  },
];

export default function Privacy() {
  const { isEnglish, locale } = useLocale();
  const title = isEnglish ? "Privacy Policy" : "개인정보처리방침";
  const description = isEnglish
    ? "How Matpick handles account, review, location, analytics, advertising, and browser data."
    : "Matpick의 회원, 리뷰, 위치, 이용 통계, 광고 및 브라우저 데이터 처리 기준을 안내합니다.";
  const sections = isEnglish ? englishSections : koreanSections;

  useSeo({
    title,
    description,
    path: "/privacy",
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `Matpick ${title}`,
      url: buildAbsoluteUrl("/privacy"),
      dateModified: "2026-07-14",
    },
  });

  return (
    <InfoPageLayout eyebrow="Privacy" title={title} description={description}>
      <div id="cookies" className="rounded-[8px] border border-[#f0dfe2] bg-[#fff8f9] p-5">
        <p className="font-bold text-[#2b2224]">
          {isEnglish ? "Review your current privacy choices" : "현재 개인정보 설정 확인"}
        </p>
        <button
          type="button"
          onClick={openPrivacySettings}
          className="mt-3 h-10 rounded-[8px] bg-[#f45f70] px-4 text-sm font-bold text-white hover:bg-[#df4f60]"
        >
          {isEnglish ? "Open privacy settings" : "광고·분석 설정 열기"}
        </button>
      </div>

      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {section.bullets ? (
            <ul className="list-disc space-y-2 pl-5">
              {section.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          ) : null}
        </Section>
      ))}

      <p className="text-sm leading-7 text-[#5f5556]">
        {isEnglish ? "For requests, see the " : "개인정보 관련 요청은 "}
        <Link href="/contact" className="font-bold text-[#e75b6c] underline">
          {isEnglish ? "contact page" : "문의 안내"}
        </Link>
        {isEnglish ? "." : "를 확인해 주세요."}
      </p>
    </InfoPageLayout>
  );
}
