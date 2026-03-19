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

export default function About() {
  const { isEnglish, locale } = useLocale();
  const page = isEnglish
    ? {
        seoTitle: "About Matpick",
        seoDescription:
          "Learn how Matpick organizes restaurant data, where the data comes from, and how the service is operated.",
        title: "About Matpick",
        description:
          "Matpick is designed to turn curated restaurant data into a discovery experience with context, sources, and practical filters.",
        section1Title: "What Matpick does",
        section1Body1:
          "Matpick helps people explore restaurants featured by creators, guides, TV shows, and editorial curation in one place with map-based browsing.",
        section1Body2:
          "You can search by region, cuisine, source, and restaurant, then review representative menus, location details, and recommendation sources on each restaurant page.",
        section2Title: "How data is organized",
        section2Body1:
          "Some information shown on Matpick comes from publicly available source material, curated guides, and metadata prepared by the team. Restaurant names, addresses, categories, sources, and map coordinates may be normalized into structured data for a better browsing experience.",
        section2Body2:
          "When coordinates are missing, Matpick may enrich the dataset directly or verify map coordinates through supported lookup tools. Data quality is continuously improved as the service grows.",
        section3Title: "Ads and monetization",
        section3Body1:
          "Matpick may include ads or affiliate links to support operating costs. Ad placements are designed to stay visually separate from editorial content and not overwhelm discovery.",
        section3Body2:
          "More details about ads, consent messaging, and tracking tools are explained in the privacy policy and related notices.",
        section4Title: "Frequently asked questions",
        faq1Question: "Is Matpick a delivery app or reservation platform?",
        faq1Answer:
          "No. Matpick is an information and discovery service focused on curated restaurant exploration.",
        faq2Question: "How are user reviews stored?",
        faq2Answer:
          "Some review and saved-place features may still rely on browser storage depending on the feature, and storage behavior can change as the product evolves.",
        faq3Question: "What if restaurant information is wrong?",
        faq3Answer:
          "You can report issues through the contact page and the team will review and update the data when needed.",
        jsonLdDescription:
          "Overview of Matpick, a curated restaurant discovery service built around creators, guides, and structured source data.",
      }
    : {
        seoTitle: "서비스 소개",
        seoDescription:
          "Matpick이 어떤 방식으로 맛집 데이터를 정리하고 사용자에게 제공하는지, 데이터 출처와 운영 기준을 소개합니다.",
        title: "Matpick 서비스 소개",
        description:
          "Matpick은 한국의 맛집 데이터를 단순한 목록이 아니라, 출처와 맥락을 함께 볼 수 있는 탐색 경험으로 정리하는 것을 목표로 합니다.",
        section1Title: "Matpick이 하는 일",
        section1Body1:
          "Matpick은 크리에이터, 가이드, 방송, 큐레이션 자료에 소개된 맛집을 한곳에서 비교하고 지도 위에서 탐색할 수 있도록 구성한 맛집 탐색 서비스입니다.",
        section1Body2:
          "사용자는 지역, 음식 종류, 출처, 개별 식당 기준으로 맛집을 찾을 수 있고, 각 식당 상세 페이지에서 대표 메뉴, 위치, 추천 출처를 함께 확인할 수 있습니다.",
        section2Title: "데이터 출처와 정리 방식",
        section2Body1:
          "서비스에 노출되는 일부 정보는 공개된 원본 자료, 가이드성 문서, 운영자가 정리한 메타데이터를 기반으로 구성됩니다. 식당명, 주소, 카테고리, 추천 출처, 지도 좌표 등은 사용성을 높이기 위해 구조화된 데이터 형태로 재정리될 수 있습니다.",
        section2Body2:
          "좌표 정보가 누락된 경우에는 데이터 파일에 보강 저장하거나 지도 제공사의 좌표 조회 기능을 통해 확인한 값을 반영합니다. 서비스 운영 중 데이터 정확도 개선을 위해 계속 업데이트될 수 있습니다.",
        section3Title: "광고와 수익화 정책",
        section3Body1:
          "Matpick은 사이트 운영비 충당을 위해 광고 또는 제휴 링크를 포함할 수 있습니다. 광고가 표시되는 영역은 콘텐츠와 구분되도록 설계하며, 광고로 인해 사용자 경험이 과도하게 저해되지 않도록 배치합니다.",
        section3Body2:
          "광고 및 분석 관련 세부 사항은 개인정보처리방침과 동의 메시지 정책에 따라 고지됩니다.",
        section4Title: "자주 묻는 질문",
        faq1Question: "Q. Matpick은 배달앱이나 예약 플랫폼인가요?",
        faq1Answer: "A. 아닙니다. Matpick은 맛집 탐색과 큐레이션에 초점을 맞춘 정보형 서비스입니다.",
        faq2Question: "Q. 사용자 리뷰는 어떻게 저장되나요?",
        faq2Answer:
          "A. 현재 일부 리뷰 및 즐겨찾기 기능은 브라우저 저장소 기반으로 동작할 수 있으며, 서비스 구조 변경 시 별도 고지될 수 있습니다.",
        faq3Question: "Q. 잘못된 식당 정보가 보이면 어떻게 하나요?",
        faq3Answer: "A. 문의 안내 페이지에 적힌 채널을 통해 제보해주시면 검토 후 반영합니다.",
        jsonLdDescription:
          "크리에이터와 가이드 기반 맛집 탐색 서비스 Matpick의 데이터 출처와 운영 기준 소개",
      };

  useSeo({
    title: page.seoTitle,
    description: page.seoDescription,
    path: "/about",
    locale,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: page.title,
        url: buildAbsoluteUrl("/about"),
        description: page.jsonLdDescription,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: isEnglish
              ? "What kind of restaurant data does Matpick show?"
              : "Matpick은 어떤 데이터를 보여주나요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: isEnglish
                ? "Matpick provides restaurant data curated from creators, guides, TV programs, and editorial lists together with map-based discovery tools."
                : "크리에이터, 가이드, 방송, 큐레이션 출처로부터 정리한 맛집 데이터와 지도 기반 탐색 정보를 제공합니다.",
            },
          },
          {
            "@type": "Question",
            name: isEnglish
              ? "Is restaurant information collected automatically?"
              : "맛집 정보는 자동으로 수집되나요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: isEnglish
                ? "Some data is gathered from source material and some is manually refined or enriched by the Matpick team."
                : "일부 데이터는 원본 자료를 기반으로 수집하고, 일부는 운영자가 정리 및 보강한 정보가 함께 반영됩니다.",
            },
          },
          {
            "@type": "Question",
            name: isEnglish
              ? "How is location data used?"
              : "사용자 위치 정보는 어떻게 쓰이나요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: isEnglish
                ? "Location is used only when the browser permission is granted, and only to support nearby discovery and distance calculations."
                : "브라우저에서 위치 권한을 허용한 경우에만 주변 맛집 탐색과 거리 계산에 사용되며, 기능 제공 목적 외에 사용하지 않습니다.",
            },
          },
        ],
      },
    ],
  });

  return (
    <InfoPageLayout
      eyebrow="About"
      title={page.title}
      description={page.description}
    >
      <Section title={page.section1Title}>
        <p>{page.section1Body1}</p>
        <p>{page.section1Body2}</p>
      </Section>

      <Section title={page.section2Title}>
        <p>{page.section2Body1}</p>
        <p>{page.section2Body2}</p>
      </Section>

      <Section title={page.section3Title}>
        <p>{page.section3Body1}</p>
        <p>{page.section3Body2}</p>
      </Section>

      <Section title={page.section4Title}>
        <p>
          <strong>{page.faq1Question}</strong>
          <br />
          {page.faq1Answer}
        </p>
        <p>
          <strong>{page.faq2Question}</strong>
          <br />
          {page.faq2Answer}
        </p>
        <p>
          <strong>{page.faq3Question}</strong>
          <br />
          {page.faq3Answer}
        </p>
      </Section>
    </InfoPageLayout>
  );
}
