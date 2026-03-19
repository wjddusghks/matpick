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
            paragraphs: ["This policy takes effect from the time it is posted on the site and may be updated with notice on this page."],
          },
        ],
      }
    : {
        seoTitle: "개인정보처리방침",
        seoDescription:
          "Matpick 서비스 이용 중 처리될 수 있는 개인정보, 쿠키, 로컬 저장소 데이터와 사용자 권리에 대해 안내합니다.",
        title: "개인정보처리방침",
        description:
          "Matpick은 서비스 운영과 기본 기능 제공에 필요한 범위 내에서만 정보를 처리하며, 브라우저 저장소와 광고 도구 사용 여부를 투명하게 안내합니다.",
        sections: [
          {
            title: "1. 수집 및 처리되는 정보",
            paragraphs: [
              "Matpick은 계정 로그인, 즐겨찾기, 위치 기반 탐색, 리뷰 작성 기능 제공을 위해 브라우저 저장소 또는 인증 서비스 연동 과정에서 제한적인 정보를 처리할 수 있습니다.",
              "처리될 수 있는 정보에는 로그인 식별자, 즐겨찾기 상태, 리뷰 초안, 브라우저 위치 권한에 따라 제공된 현재 위치 정보, 광고 및 분석 도구 사용 기록이 포함될 수 있습니다.",
            ],
          },
          {
            title: "2. 위치 정보 처리",
            paragraphs: [
              "사용자가 브라우저에서 위치 권한을 허용한 경우에만 현재 위치를 기준으로 주변 맛집 탐색 및 거리 계산 기능을 제공합니다. 위치 정보는 기능 제공 목적 외에 사용하지 않으며, 브라우저 설정 또는 저장소 삭제를 통해 제거할 수 있습니다.",
            ],
          },
          {
            title: "3. 쿠키 및 브라우저 저장소",
            paragraphs: [
              "Matpick은 서비스 선호 설정, 최근 검색어, 즐겨찾기, 일부 리뷰 정보 저장을 위해 브라우저의 로컬 저장소를 사용할 수 있습니다. 또한 광고 제공, 성과 측정, 동의 메시지 제공을 위해 제3자 쿠키나 유사 기술이 사용될 수 있습니다.",
              "사용자는 브라우저 설정에서 쿠키 또는 저장소를 삭제하거나, 동의 메시지를 통해 일부 처리에 대한 선택을 변경할 수 있습니다.",
            ],
          },
          {
            title: "4. 제3자 서비스",
            paragraphs: [
              "Matpick은 지도 서비스, 로그인 연동, 광고 제공, 배포 인프라 등 제3자 서비스를 이용할 수 있습니다. 대표적으로 지도 SDK, 인증 서비스, Google AdSense, Vercel과 같은 도구가 포함될 수 있습니다.",
              "각 제3자 서비스는 자체 정책에 따라 정보를 처리할 수 있으며, 사용자는 해당 서비스의 정책도 함께 확인하는 것이 좋습니다.",
            ],
          },
          {
            title: "5. 사용자 권리와 문의",
            paragraphs: [
              "사용자는 브라우저 저장소 삭제, 위치 권한 해제, 광고 동의 변경 등을 통해 자신의 데이터 사용 범위를 조정할 수 있습니다. 서비스 운영 정책이나 개인정보 처리에 대한 문의는 문의 안내 페이지를 통해 확인할 수 있습니다.",
            ],
          },
          {
            title: "6. 시행일",
            paragraphs: ["본 방침은 사이트에 게시된 시점부터 적용됩니다. 정책 변경 시 본 페이지를 통해 고지합니다."],
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
    <InfoPageLayout
      eyebrow="Privacy"
      title={page.title}
      description={page.description}
    >
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
