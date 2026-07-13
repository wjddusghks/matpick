import type { ReactNode } from "react";
import InfoPageLayout from "@/components/InfoPageLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

type TermsSection = {
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

const koreanSections: TermsSection[] = [
  {
    title: "1. 목적과 적용",
    paragraphs: [
      "이 약관은 Matpick 운영자(이하 ‘운영자’)가 matpick.co.kr에서 제공하는 맛집 탐색, 지도, 회원, 즐겨찾기, 리뷰 및 관련 서비스의 이용 조건을 정합니다. 서비스를 이용하면 이 약관과 개인정보처리방침의 적용을 받습니다.",
    ],
  },
  {
    title: "2. 서비스의 성격",
    paragraphs: [
      "Matpick은 방송, 크리에이터, 가이드와 공개 자료에 소개된 식당 정보를 구조화해 보여주는 큐레이션·정보 탐색 서비스입니다. 예약, 주문, 배달, 결제 또는 식당 영업을 직접 제공하거나 중개하지 않습니다.",
    ],
  },
  {
    title: "3. 회원 계정",
    paragraphs: [
      "회원은 NAVER 또는 Kakao 등 지원되는 로그인 계정을 적법하게 사용해야 하며, 자신의 기기와 로그인 상태를 관리할 책임이 있습니다. 타인의 계정을 이용하거나 식별정보를 위조해서는 안 됩니다. 계정 삭제 및 개인정보 관련 요청은 문의 안내에 따라 접수할 수 있습니다.",
    ],
  },
  {
    title: "4. 식당 정보와 출처",
    paragraphs: [
      "운영자는 식당명, 주소, 메뉴, 가격, 영업 상태, 지도 좌표와 출처를 지속적으로 확인하지만 최신성이나 완전성을 보장하지 않습니다. 가격, 메뉴, 휴무와 폐업 여부는 방문 전에 식당 또는 공식 지도 서비스에서 다시 확인해야 합니다.",
      "방송명·프로그램명, 가이드 명칭, 상표와 원본 자료의 권리는 각 권리자에게 있습니다. Matpick의 출처 표시는 제휴 또는 보증을 의미하지 않습니다.",
    ],
  },
  {
    title: "5. 이용자 리뷰와 사진",
    paragraphs: [
      "이용자는 자신이 작성하거나 적법한 권리를 가진 리뷰와 사진만 게시해야 합니다. 이용자는 게시물을 서비스에서 저장, 표시, 크기 조정 및 전송하는 데 필요한 비독점적이고 무상인 이용 권한을 운영자에게 부여합니다. 이 권한은 게시물 삭제 시 종료되지만 백업, 법적 의무 또는 이미 처리된 신고 기록에는 합리적인 기간 동안 남을 수 있습니다.",
    ],
    bullets: [
      "허위 사실, 광고성 도배, 명예훼손, 혐오·불법 정보 게시 금지",
      "타인의 얼굴, 개인정보, 저작물 또는 상표를 권한 없이 게시하는 행위 금지",
      "악성 코드, 자동화된 대량 요청, 서비스 방해 행위 금지",
    ],
  },
  {
    title: "6. Matpick 콘텐츠와 무단 이용 금지",
    paragraphs: [
      "서비스의 편집 구성, 데이터 배열, 자체 제작 카드 이미지, 문구, 코드와 브랜드 자산은 운영자 또는 해당 권리자의 보호를 받습니다. 개인적인 식당 탐색을 위한 통상적 이용을 넘어 이미지·데이터를 대량 복제, 재배포, 판매, 자동 수집하거나 유사 서비스의 데이터베이스를 만드는 행위는 사전 서면 허락 없이 금지됩니다.",
      "브라우저에 표시된 자료는 기술적으로 캡처될 수 있으나, 표시 가능하다는 사실이 저작권이나 이용 허락을 부여하는 것은 아닙니다.",
    ],
  },
  {
    title: "7. 광고와 제휴 링크",
    paragraphs: [
      "서비스에는 Google AdSense, 카카오 애드핏 및 쿠팡 파트너스 등 광고·제휴 링크가 포함될 수 있습니다. 쿠팡 파트너스 링크를 통한 구매가 발생하면 Matpick이 일정액의 수수료를 받을 수 있으며 이용자의 구매 가격에는 영향을 주지 않습니다. 광고는 편집 콘텐츠와 구분해 표시합니다.",
    ],
  },
  {
    title: "8. 외부 서비스",
    paragraphs: [
      "지도, 로그인, 광고 또는 외부 링크의 기능과 거래에는 해당 사업자의 약관과 정책이 적용됩니다. 운영자는 외부 사업자의 서비스 상태, 상품, 결제, 배송, 예약 또는 개인정보 처리 결과를 통제하지 않습니다.",
    ],
  },
  {
    title: "9. 콘텐츠 조치와 권리 침해 신고",
    paragraphs: [
      "운영자는 법령·약관 위반, 권리 침해, 보안 위험 또는 명백한 정보 오류가 있는 콘텐츠를 사전 통지 없이 숨기거나 삭제하고 계정 이용을 제한할 수 있습니다. 식당 정보 정정, 사진·저작권·초상권 삭제 요청은 문의 페이지의 비공개 연락 채널로 접수해 주세요. 권리자와 대상 URL, 요청 사유를 확인할 수 있는 자료가 필요할 수 있습니다.",
    ],
  },
  {
    title: "10. 서비스 변경과 중단",
    paragraphs: [
      "품질 개선, 비용, 보안, 법령 또는 외부 API 정책 변경에 따라 기능과 콘텐츠를 추가·변경·중단할 수 있습니다. 중요한 정책 변경이나 장기 중단은 가능한 범위에서 사이트를 통해 안내합니다.",
    ],
  },
  {
    title: "11. 책임의 범위",
    paragraphs: [
      "Matpick은 정보 탐색을 돕는 서비스이며 특정 식당의 품질, 안전, 영업 여부, 가격이나 이용 결과를 보증하지 않습니다. 운영자의 고의 또는 중대한 과실이 없는 한, 이용자의 방문·구매·예약 판단이나 외부 서비스 이용에서 발생한 손해에 대한 책임은 관련 법령이 허용하는 범위에서 제한됩니다. 소비자에게 적용되는 강행규정상의 권리는 제한되지 않습니다.",
    ],
  },
  {
    title: "12. 준거법, 문의와 시행일",
    paragraphs: [
      "이 약관은 대한민국 법률을 준거법으로 하며 분쟁은 민사소송법 등 관계 법령이 정한 관할 법원에서 해결합니다. 약관과 서비스 운영 문의는 Instagram @matpick.co.kr DM을 이용해 주세요.",
      "본 약관의 시행일은 2026년 7월 14일입니다.",
    ],
  },
];

const englishSections: TermsSection[] = [
  {
    title: "1. Scope and service",
    paragraphs: [
      "These terms govern Matpick restaurant discovery, maps, accounts, favorites, reviews, and related features at matpick.co.kr. Matpick is a curated information service and does not directly provide or broker reservations, orders, delivery, payments, or restaurant operations.",
    ],
  },
  {
    title: "2. Accounts and acceptable use",
    paragraphs: [
      "Members must lawfully use their supported NAVER or Kakao account and protect their device and session. Impersonation, false identifiers, unlawful content, automated bulk requests, malware, or interference with the service is prohibited.",
    ],
  },
  {
    title: "3. Restaurant information",
    paragraphs: [
      "We work to verify names, addresses, menus, prices, operating status, coordinates, and sources, but do not guarantee that every detail is current or complete. Confirm prices, hours, closures, and menus with the restaurant or an official map service before visiting. Source names and trademarks remain the property of their owners and attribution does not imply endorsement.",
    ],
  },
  {
    title: "4. Reviews and photos",
    paragraphs: [
      "Users may upload only content they created or have the right to use. You grant Matpick a non-exclusive, royalty-free license needed to store, display, resize, and transmit the post in the service. The license ends when the post is deleted, subject to reasonable backups, legal duties, and completed moderation records.",
    ],
  },
  {
    title: "5. Matpick content",
    paragraphs: [
      "The editorial structure, data arrangement, original card images, copy, code, and brand assets are protected by Matpick or their respective owners. Bulk copying, redistribution, resale, scraping, or building a competing database without prior written permission is prohibited. Display in a browser does not grant a copyright license.",
    ],
  },
  {
    title: "6. Advertising and external services",
    paragraphs: [
      "Matpick may show Google AdSense, Kakao AdFit, and Coupang Partners advertising. Matpick may earn a commission from qualifying Coupang purchases without changing the buyer's price. Third-party maps, sign-in, ads, links, and transactions are governed by the provider's terms and policies.",
    ],
  },
  {
    title: "7. Moderation and removal requests",
    paragraphs: [
      "We may hide or remove content and restrict accounts for legal, rights, security, accuracy, or policy reasons. Data corrections and copyright, privacy, or image removal requests should be sent through the private channel on the contact page with the affected URL and evidence of authority.",
    ],
  },
  {
    title: "8. Changes, disclaimers, and law",
    paragraphs: [
      "Features may change or stop because of quality, cost, security, law, or external API policy. Matpick does not guarantee a restaurant's quality, safety, operation, price, or outcome. Liability is limited only to the extent permitted by law and mandatory consumer rights remain intact.",
      "Korean law governs these terms. The effective date is July 14, 2026. Contact Instagram @matpick.co.kr for service or policy questions.",
    ],
  },
];

export default function Terms() {
  const { isEnglish, locale } = useLocale();
  const title = isEnglish ? "Terms of Service" : "이용약관";
  const description = isEnglish
    ? "Rules for Matpick accounts, restaurant information, reviews, images, advertising, and service use."
    : "Matpick 회원, 식당 정보, 리뷰·사진, 광고 및 서비스 이용에 적용되는 기준입니다.";
  const sections = isEnglish ? englishSections : koreanSections;

  useSeo({
    title,
    description,
    path: "/terms",
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `Matpick ${title}`,
      url: buildAbsoluteUrl("/terms"),
      dateModified: "2026-07-14",
    },
  });

  return (
    <InfoPageLayout eyebrow="Terms" title={title} description={description}>
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
    </InfoPageLayout>
  );
}
