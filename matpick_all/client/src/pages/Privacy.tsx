import type { ReactNode } from "react";
import InfoPageLayout from "@/components/InfoPageLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold tracking-[-0.03em] text-[#1f1718]">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-[#5f5556] sm:text-[15px]">{children}</div>
    </section>
  );
}

export default function Privacy() {
  const { isEnglish, locale } = useLocale();
  const page = isEnglish
    ? {
        seoTitle: "Privacy Policy",
        seoDescription:
          "Learn how Matpick handles personal data, cookies, browser storage, and user rights while using the service.",
        title: "Privacy Policy",
        description:
          "Matpick only handles information that is needed to run the service and clearly explains the use of browser storage, cookies, and ad-related tools.",
        sections: [
          {
            title: "1. Information we may process",
            paragraphs: [
              "Matpick may process limited information through browser storage or third-party sign-in flows to support account login, saved places, location-based discovery, and review features.",
              "This can include sign-in identifiers, saved-place state, draft reviews, current location when permission is granted, and records related to advertising or analytics tools.",
            ],
          },
          {
            title: "2. Location data",
            paragraphs: [
              "Current location is used only when you explicitly grant location access in the browser, and only to help with nearby restaurant discovery and distance calculations.",
            ],
          },
          {
            title: "3. Cookies and browser storage",
            paragraphs: [
              "Matpick may use browser local storage to keep preferences, recent searches, saved places, and some review data. Third-party cookies or similar technologies may also be used for ads, measurement, and consent flows.",
              "You can clear cookies and browser storage or change some consent choices through your browser settings and consent message controls.",
            ],
          },
          {
            title: "4. Third-party services",
            paragraphs: [
              "Matpick may rely on third-party services for maps, login, advertising, and deployment infrastructure. This can include mapping SDKs, authentication services, Google AdSense, and Vercel.",
              "Each third-party service may process information according to its own policy, so reviewing those policies is recommended.",
            ],
          },
          {
            title: "5. Your rights and contact",
            paragraphs: [
              "You can manage how data is used by clearing browser storage, revoking location permission, or updating ad-consent choices. For questions about service operations or privacy handling, refer to the contact page.",
            ],
          },
          {
            title: "6. Effective date",
            paragraphs: [
              "This policy takes effect from the time it is posted on the site and may be updated with notice on this page.",
            ],
          },
        ],
      }
    : {
        seoTitle: "개인정보처리방침",
        seoDescription:
          "Matpick 서비스 이용 중 처리될 수 있는 개인정보, 쿠키, 브라우저 저장소 사용 방식과 이용자 권리를 안내합니다.",
        title: "개인정보처리방침",
        description:
          "Matpick은 서비스 운영에 필요한 범위 안에서만 정보를 처리하며, 브라우저 저장소와 광고 도구 사용 방식도 함께 안내합니다.",
        sections: [
          {
            title: "1. 수집 및 처리하는 정보",
            paragraphs: [
              "Matpick은 로그인, 저장한 맛집, 위치 기반 탐색, 리뷰 기능을 제공하기 위해 브라우저 저장소 또는 제3자 로그인 연동 과정에서 제한적인 정보를 처리할 수 있습니다.",
              "처리될 수 있는 정보에는 로그인 식별자, 저장한 맛집 상태, 리뷰 초안, 위치 권한이 허용된 경우의 현재 위치, 광고 및 성과 측정 관련 기록이 포함될 수 있습니다.",
            ],
          },
          {
            title: "2. 위치 정보",
            paragraphs: [
              "현재 위치 정보는 브라우저에서 위치 권한을 직접 허용한 경우에만 사용되며, 주변 식당 탐색과 거리 계산을 돕는 목적에 한해 처리됩니다.",
            ],
          },
          {
            title: "3. 쿠키 및 브라우저 저장소",
            paragraphs: [
              "Matpick은 서비스 선호 설정, 최근 검색어, 저장한 맛집, 일부 리뷰 정보를 유지하기 위해 브라우저 저장소를 사용할 수 있습니다. 광고, 측정, 동의 메시지 제공을 위해 제3자 쿠키 또는 유사 기술이 사용될 수도 있습니다.",
              "이용자는 브라우저 설정을 통해 쿠키나 저장소를 삭제하거나, 동의 메시지를 통해 일부 처리 방식을 조정할 수 있습니다.",
            ],
          },
          {
            title: "4. 외부 서비스",
            paragraphs: [
              "Matpick은 지도, 로그인, 광고, 배포 인프라를 위해 외부 서비스를 이용할 수 있습니다. 예를 들어 지도 SDK, 인증 서비스, Google AdSense, Vercel 등이 포함될 수 있습니다.",
              "각 외부 서비스는 자체 정책에 따라 정보를 처리할 수 있으므로, 필요한 경우 해당 서비스의 정책도 함께 확인해 주세요.",
            ],
          },
          {
            title: "5. 이용자 권리와 문의",
            paragraphs: [
              "이용자는 브라우저 저장소 삭제, 위치 권한 철회, 광고 동의 설정 변경 등을 통해 자신의 정보 사용 범위를 조정할 수 있습니다. 서비스 운영 또는 개인정보 처리에 대한 문의는 문의 페이지 또는 Instagram @matpick.co.kr 계정으로 알려 주세요.",
            ],
          },
          {
            title: "6. 시행일",
            paragraphs: [
              "이 방침은 사이트에 게시된 시점부터 적용되며, 내용이 변경될 경우 이 페이지를 통해 안내합니다.",
            ],
          },
        ],
      };

  useSeo({
    title: page.seoTitle,
    description: page.seoDescription,
    path: "/privacy",
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `Matpick ${page.title}`,
      url: buildAbsoluteUrl("/privacy"),
    },
  });

  return (
    <InfoPageLayout eyebrow="Privacy" title={page.title} description={page.description}>
      {page.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </Section>
      ))}
    </InfoPageLayout>
  );
}
