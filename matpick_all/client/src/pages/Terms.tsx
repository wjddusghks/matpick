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

export default function Terms() {
  const { isEnglish, locale } = useLocale();
  const page = isEnglish
    ? {
        seoTitle: "Terms of Service",
        seoDescription:
          "Review the basic usage terms, content guidelines, limitations, and service policies that apply to Matpick.",
        title: "Terms of Service",
        description:
          "These terms explain the basic rules that apply to how Matpick presents information and how users interact with the service.",
        sections: [
          {
            title: "1. Nature of the service",
            body:
              "Matpick is a curated restaurant discovery service. It does not directly provide booking, ordering, delivery, or payment processing and may include links to third-party services.",
          },
          {
            title: "2. Using content and information",
            body:
              "Restaurant details, categories, map positions, and source references are provided for convenience. While Matpick works to improve accuracy, operating status, prices, menus, and business hours may change and should be checked again before visiting.",
          },
          {
            title: "3. User responsibilities",
            body:
              "Users must use the service in accordance with applicable laws and common standards and must not abuse features or submit false information. When browser-storage-based features are used, each user remains responsible for managing their own device and session.",
          },
          {
            title: "4. Ads and external links",
            body:
              "The site may include ads or affiliate links. Transactions or losses that happen through external sites, services, or affiliate links may be governed by the policies of those external services.",
          },
          {
            title: "5. Service changes and interruptions",
            body:
              "Matpick may change, add, remove, or suspend features and content to improve quality, reflect policy updates, or respond to technical needs. Important policy changes are announced through the relevant pages.",
          },
          {
            title: "6. Disclaimer",
            body:
              "Matpick is an informational service and does not guarantee the quality or outcomes of specific restaurants, products, or services. Liability may be limited to the extent permitted by law for issues arising from visits, purchases, bookings, or travel decisions made by users.",
          },
        ],
      }
    : {
        seoTitle: "이용약관",
        seoDescription:
          "Matpick 서비스 이용 시 적용되는 기본 이용 조건, 콘텐츠 사용 기준, 면책 및 운영 정책을 안내합니다.",
        title: "이용약관",
        description: "본 약관은 Matpick 서비스의 정보 제공 범위와 사용자 이용 원칙을 정리한 기본 정책입니다.",
        sections: [
          {
            title: "1. 서비스 성격",
            body:
              "Matpick은 맛집 탐색과 정보 열람을 위한 큐레이션 서비스입니다. 예약, 주문, 배달, 결제 자체를 직접 제공하는 플랫폼이 아니며, 제3자 서비스로 이동하는 링크를 포함할 수 있습니다.",
          },
          {
            title: "2. 콘텐츠와 정보 이용",
            body:
              "사이트에 게시된 식당 정보, 카테고리, 지도 위치, 출처 정보는 사용자 편의를 위해 제공됩니다. 운영자는 정확성 향상을 위해 노력하지만, 실제 영업 여부, 가격, 메뉴, 운영시간 등은 변동될 수 있으므로 방문 전 추가 확인이 필요할 수 있습니다.",
          },
          {
            title: "3. 사용자 책임",
            body:
              "사용자는 서비스를 법령과 사회 통념에 맞게 이용해야 하며, 사이트 기능을 악용하거나 허위 정보를 게시해서는 안 됩니다. 브라우저 저장소 기반 기능을 사용하는 경우 본인의 기기 관리에 대한 책임은 사용자에게 있습니다.",
          },
          {
            title: "4. 광고 및 외부 링크",
            body:
              "사이트에는 광고 또는 제휴 링크가 포함될 수 있습니다. 외부 사이트, 외부 서비스, 제휴 링크를 통해 발생하는 거래 또는 손해에 대해서는 해당 서비스의 정책이 우선 적용될 수 있습니다.",
          },
          {
            title: "5. 서비스 변경 및 중단",
            body:
              "운영자는 서비스 품질 향상, 정책 변경, 기술적 필요에 따라 일부 기능 또는 콘텐츠를 수정, 추가, 제거할 수 있습니다. 중요한 정책 변경은 관련 페이지를 통해 고지합니다.",
          },
          {
            title: "6. 면책",
            body:
              "Matpick은 정보 제공 서비스이며, 특정 식당, 상품, 서비스의 품질이나 결과를 보증하지 않습니다. 사용자 판단에 따른 방문, 구매, 예약, 이동 과정에서 발생하는 문제에 대해서는 법령상 허용되는 범위 내에서 책임이 제한될 수 있습니다.",
          },
        ],
      };

  useSeo({
    title: page.seoTitle,
    description: page.seoDescription,
    path: "/terms",
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: `Matpick ${page.title}`,
      url: buildAbsoluteUrl("/terms"),
    },
  });

  return (
    <InfoPageLayout
      eyebrow="Terms"
      title={page.title}
      description={page.description}
    >
      {page.sections.map((section) => (
        <Section key={section.title} title={section.title}>
          <p>{section.body}</p>
        </Section>
      ))}
    </InfoPageLayout>
  );
}
