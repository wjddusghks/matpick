import type { ReactNode } from "react";
import InfoPageLayout from "@/components/InfoPageLayout";
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
  useSeo({
    title: "서비스 소개",
    description:
      "Matpick이 어떤 방식으로 맛집 데이터를 정리하고 사용자에게 제공하는지, 데이터 출처와 운영 기준을 소개합니다.",
    path: "/about",
    jsonLd: [
      {
        "@context": "https://schema.org",
        "@type": "AboutPage",
        name: "Matpick 서비스 소개",
        url: buildAbsoluteUrl("/about"),
        description:
          "크리에이터와 가이드 기반 맛집 탐색 서비스 Matpick의 데이터 출처와 운영 기준 소개",
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: [
          {
            "@type": "Question",
            name: "Matpick은 어떤 데이터를 보여주나요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "크리에이터, 가이드, 방송, 큐레이션 출처로부터 정리한 맛집 데이터와 지도 기반 탐색 정보를 제공합니다.",
            },
          },
          {
            "@type": "Question",
            name: "맛집 정보는 자동으로 수집되나요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "일부 데이터는 원본 자료를 기반으로 수집하고, 일부는 운영자가 정리 및 보강한 정보가 함께 반영됩니다.",
            },
          },
          {
            "@type": "Question",
            name: "사용자 위치 정보는 어떻게 쓰이나요?",
            acceptedAnswer: {
              "@type": "Answer",
              text: "브라우저에서 위치 권한을 허용한 경우에만 주변 맛집 탐색과 거리 계산에 사용되며, 기능 제공 목적 외에 사용하지 않습니다.",
            },
          },
        ],
      },
    ],
  });

  return (
    <InfoPageLayout
      eyebrow="About"
      title="Matpick 서비스 소개"
      description="Matpick은 한국의 맛집 데이터를 단순한 목록이 아니라, 출처와 맥락을 함께 볼 수 있는 탐색 경험으로 정리하는 것을 목표로 합니다."
    >
      <Section title="Matpick이 하는 일">
        <p>
          Matpick은 크리에이터, 가이드, 방송, 큐레이션 자료에 소개된 맛집을 한곳에서
          비교하고 지도 위에서 탐색할 수 있도록 구성한 맛집 탐색 서비스입니다.
        </p>
        <p>
          사용자는 지역, 음식 종류, 출처, 개별 식당 기준으로 맛집을 찾을 수 있고,
          각 식당 상세 페이지에서 대표 메뉴, 위치, 추천 출처를 함께 확인할 수 있습니다.
        </p>
      </Section>

      <Section title="데이터 출처와 정리 방식">
        <p>
          서비스에 노출되는 일부 정보는 공개된 원본 자료, 가이드성 문서, 운영자가 정리한
          메타데이터를 기반으로 구성됩니다. 식당명, 주소, 카테고리, 추천 출처, 지도 좌표 등은
          사용성을 높이기 위해 구조화된 데이터 형태로 재정리될 수 있습니다.
        </p>
        <p>
          좌표 정보가 누락된 경우에는 데이터 파일에 보강 저장하거나 지도 제공사의 좌표 조회
          기능을 통해 확인한 값을 반영합니다. 서비스 운영 중 데이터 정확도 개선을 위해 계속
          업데이트될 수 있습니다.
        </p>
      </Section>

      <Section title="광고와 수익화 정책">
        <p>
          Matpick은 사이트 운영비 충당을 위해 광고 또는 제휴 링크를 포함할 수 있습니다.
          광고가 표시되는 영역은 콘텐츠와 구분되도록 설계하며, 광고로 인해 사용자 경험이 과도하게
          저해되지 않도록 배치합니다.
        </p>
        <p>
          광고 및 분석 관련 세부 사항은 개인정보처리방침과 동의 메시지 정책에 따라 고지됩니다.
        </p>
      </Section>

      <Section title="자주 묻는 질문">
        <p>
          <strong>Q. Matpick은 배달앱이나 예약 플랫폼인가요?</strong>
          <br />
          A. 아닙니다. Matpick은 맛집 탐색과 큐레이션에 초점을 맞춘 정보형 서비스입니다.
        </p>
        <p>
          <strong>Q. 사용자 리뷰는 어떻게 저장되나요?</strong>
          <br />
          A. 현재 일부 리뷰 및 즐겨찾기 기능은 브라우저 저장소 기반으로 동작할 수 있으며,
          서비스 구조 변경 시 별도 고지될 수 있습니다.
        </p>
        <p>
          <strong>Q. 잘못된 식당 정보가 보이면 어떻게 하나요?</strong>
          <br />
          A. 문의 안내 페이지에 적힌 채널을 통해 제보해주시면 검토 후 반영합니다.
        </p>
      </Section>
    </InfoPageLayout>
  );
}
