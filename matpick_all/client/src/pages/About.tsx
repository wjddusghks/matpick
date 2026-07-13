import type { ReactNode } from "react";
import InfoPageLayout from "@/components/InfoPageLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

type AboutSection = {
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

const koreanSections: AboutSection[] = [
  {
    title: "Matpick이 하는 일",
    paragraphs: [
      "Matpick은 방송, 크리에이터, 가이드와 편집 목록에 소개된 식당을 같은 기준으로 비교하고 지도에서 찾을 수 있게 정리하는 맛집 탐색 서비스입니다. 단순한 이미지 모음이 아니라 출처, 소개 회차, 지역, 음식 종류, 대표 메뉴와 주소를 연결해 ‘왜 이 식당이 목록에 있는지’를 확인할 수 있게 만드는 것이 목표입니다.",
      "이용자는 주제와 회차를 먼저 고르거나, 지역·카테고리·식당명으로 검색한 뒤 상세 페이지에서 출처와 지도 이동 경로를 확인할 수 있습니다.",
    ],
  },
  {
    title: "데이터 편집 원칙",
    paragraphs: [
      "공개된 방송·가이드의 식당 목록을 출발점으로 삼되, 서비스에 올리기 전에 식당명을 통일하고 지점 여부, 도로명 주소, 지역, 음식 카테고리와 대표 메뉴를 구조화합니다. 좌표는 주소와 실제 지점이 일치하는지 확인한 뒤 반영하고, 중복 항목은 출처 관계를 유지한 채 하나의 식당 정보로 연결합니다.",
    ],
    bullets: [
      "출처와 회차를 식당 데이터와 함께 보존",
      "동일 상호의 지점과 본점을 구분",
      "메뉴·가격은 확인 가능한 자료의 기준 시점을 반영",
      "폐업이 확인된 식당은 삭제하지 않고 폐업 상태로 표시",
      "오류 제보를 검토해 주소·메뉴·좌표와 이미지를 계속 보정",
    ],
  },
  {
    title: "카드 이미지와 실제 사진의 구분",
    paragraphs: [
      "회차·식당 카드 이미지는 목록을 빠르게 구분하기 위해 Matpick이 자체 편집한 시각 자료입니다. 일부 카드는 생성형 이미지 도구의 도움을 받아 제작될 수 있으며, 실제 매장에서 촬영한 메뉴 사진이나 방송 원본 화면을 의미하지 않습니다. 실제 방문 판단은 식당의 최신 메뉴와 공식 안내를 함께 확인해야 합니다.",
      "외부 권리자가 제공하거나 이용자가 업로드한 사진은 해당 권리와 요청 절차에 따라 관리합니다. 권리 침해 또는 잘못 연결된 이미지가 있으면 문의 페이지에서 대상 URL과 함께 알려 주세요.",
    ],
  },
  {
    title: "정확성, 독립성 및 업데이트",
    paragraphs: [
      "식당 정보는 시간이 지나며 달라질 수 있습니다. Matpick은 확인된 기준일의 정보를 제공하고 정정 요청을 반영하지만 영업시간, 가격, 휴무, 예약 가능 여부를 보증하지 않습니다. 방문 직전 식당 또는 공식 지도 정보를 확인해 주세요.",
      "목록 포함 여부는 출처와 편집 기준에 따라 정하며 광고 구매 여부와 분리합니다. 광고 또는 제휴 배너는 광고로 표시하고, 쿠팡 파트너스 링크를 통한 구매가 발생하면 운영 수수료를 받을 수 있습니다.",
    ],
  },
  {
    title: "자주 묻는 질문",
    paragraphs: [
      "Q. 배달·예약 서비스인가요?\nA. 아닙니다. Matpick은 식당 정보와 출처를 탐색하는 서비스이며 예약·주문·결제를 직접 처리하지 않습니다.",
      "Q. 현재 위치는 저장되나요?\nA. 브라우저에서 허용했을 때 주변 식당 정렬과 거리 계산에 사용하며 좌표 자체를 회원 프로필에 저장하지 않는 것이 원칙입니다.",
      "Q. 정보가 틀리거나 사진 삭제가 필요하면 어떻게 하나요?\nA. 문의 페이지의 Instagram DM으로 식당명과 대상 URL, 확인 근거를 보내면 검토합니다. 개인정보는 공개 GitHub 이슈에 남기지 마세요.",
    ],
  },
];

const englishSections: AboutSection[] = [
  {
    title: "What Matpick does",
    paragraphs: [
      "Matpick organizes restaurants featured by TV programs, creators, guides, and editorial lists so they can be compared under consistent filters and found on a map. Each entry connects its source and episode with region, cuisine, representative menu, and address instead of acting as a simple image gallery.",
      "Visitors can start from a topic or episode, search by restaurant, region, or cuisine, and then review source context and map links on the detail page.",
    ],
  },
  {
    title: "Editorial method",
    paragraphs: [
      "Public source lists are normalized before publication. We distinguish branches, standardize road addresses and categories, verify coordinates against the intended location, preserve source relationships, and connect duplicate references to one restaurant record.",
    ],
    bullets: [
      "Preserve source and episode context",
      "Distinguish branches with similar names",
      "Record the verification point for menus and prices",
      "Mark confirmed closures instead of silently deleting history",
      "Review reports and continuously correct addresses, menus, coordinates, and images",
    ],
  },
  {
    title: "Card artwork versus restaurant photography",
    paragraphs: [
      "Episode and restaurant cards are original editorial artwork created to make lists easy to scan. Some cards may be produced with assistance from generative image tools. They are visual references, not claims that the image was photographed at the restaurant or taken from a broadcast.",
      "Third-party or user-uploaded photographs remain subject to their owners' rights and the removal process on the contact page.",
    ],
  },
  {
    title: "Accuracy and independence",
    paragraphs: [
      "Restaurant details change. Matpick publishes information verified at a point in time and reviews correction requests, but does not guarantee current hours, prices, closures, or reservations. Confirm critical details before visiting.",
      "Editorial inclusion follows source and curation rules and is separate from ad purchases. Ads and affiliate placements are labeled; Matpick may earn a commission from qualifying Coupang Partners purchases.",
    ],
  },
  {
    title: "Frequently asked questions",
    paragraphs: [
      "Is Matpick a delivery or reservation service? No. It is a restaurant information and source-discovery service and does not process orders or payments.",
      "Is current location stored? It is used after browser permission for nearby sorting and distance calculations and is not normally saved in the member profile.",
      "How can I correct data or request image removal? Send the restaurant name, affected URL, and supporting details through Instagram DM on the contact page. Never post personal data in a public GitHub issue.",
    ],
  },
];

export default function About() {
  const { isEnglish, locale } = useLocale();
  const title = isEnglish ? "About Matpick" : "Matpick 서비스 소개";
  const description = isEnglish
    ? "How Matpick researches, structures, illustrates, verifies, and updates curated restaurant information."
    : "Matpick이 큐레이션 맛집 정보를 조사하고 구조화하며 이미지·좌표·출처를 검증하는 방식을 소개합니다.";
  const sections = isEnglish ? englishSections : koreanSections;

  useSeo({
    title,
    description,
    path: "/about",
    locale,
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: title,
        url: buildAbsoluteUrl("/about"),
        description,
        dateModified: "2026-07-14",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: isEnglish ? "Is Matpick a delivery service?" : "Matpick은 배달 서비스인가요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: isEnglish
                ? "No. Matpick is a curated restaurant information and discovery service."
                : "아닙니다. Matpick은 큐레이션 맛집 정보와 출처를 탐색하는 서비스입니다.",
            },
          },
          {
            "@type": "Question",
            name: isEnglish ? "How does Matpick verify data?" : "식당 데이터는 어떻게 확인하나요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: isEnglish
                ? "Source lists are normalized, branches are distinguished, and addresses and coordinates are checked before publication."
                : "출처 목록을 구조화하고 지점을 구분한 뒤 주소와 좌표를 확인해 반영합니다.",
            },
          },
        ],
      },
    ],
  });

  return (
    <InfoPageLayout eyebrow="About" title={title} description={description}>
      {sections.map((section) => (
        <Section key={section.title} title={section.title}>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="whitespace-pre-line">
              {paragraph}
            </p>
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
    </InfoPageLayout>
  );
}
