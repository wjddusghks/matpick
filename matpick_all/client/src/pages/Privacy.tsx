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

export default function Privacy() {
  useSeo({
    title: "개인정보처리방침",
    description:
      "Matpick 서비스 이용 중 처리될 수 있는 개인정보, 쿠키, 로컬 저장소 데이터와 사용자 권리에 대해 안내합니다.",
    path: "/privacy",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "WebPage",
      name: "Matpick 개인정보처리방침",
      url: buildAbsoluteUrl("/privacy"),
    },
  });

  return (
    <InfoPageLayout
      eyebrow="Privacy"
      title="개인정보처리방침"
      description="Matpick은 서비스 운영과 기본 기능 제공에 필요한 범위 내에서만 정보를 처리하며, 브라우저 저장소와 광고 도구 사용 여부를 투명하게 안내합니다."
    >
      <Section title="1. 수집 및 처리되는 정보">
        <p>
          Matpick은 계정 로그인, 즐겨찾기, 위치 기반 탐색, 리뷰 작성 기능 제공을 위해 브라우저
          저장소 또는 인증 서비스 연동 과정에서 제한적인 정보를 처리할 수 있습니다.
        </p>
        <p>
          처리될 수 있는 정보에는 로그인 식별자, 즐겨찾기 상태, 리뷰 초안, 브라우저 위치 권한에
          따라 제공된 현재 위치 정보, 광고 및 분석 도구 사용 기록이 포함될 수 있습니다.
        </p>
      </Section>

      <Section title="2. 위치 정보 처리">
        <p>
          사용자가 브라우저에서 위치 권한을 허용한 경우에만 현재 위치를 기준으로 주변 맛집 탐색 및
          거리 계산 기능을 제공합니다. 위치 정보는 기능 제공 목적 외에 사용하지 않으며, 브라우저
          설정 또는 저장소 삭제를 통해 제거할 수 있습니다.
        </p>
      </Section>

      <Section title="3. 쿠키 및 브라우저 저장소">
        <p>
          Matpick은 서비스 선호 설정, 최근 검색어, 즐겨찾기, 일부 리뷰 정보 저장을 위해 브라우저의
          로컬 저장소를 사용할 수 있습니다. 또한 광고 제공, 성과 측정, 동의 메시지 제공을 위해
          제3자 쿠키나 유사 기술이 사용될 수 있습니다.
        </p>
        <p>
          사용자는 브라우저 설정에서 쿠키 또는 저장소를 삭제하거나, 동의 메시지를 통해 일부 처리에
          대한 선택을 변경할 수 있습니다.
        </p>
      </Section>

      <Section title="4. 제3자 서비스">
        <p>
          Matpick은 지도 서비스, 로그인 연동, 광고 제공, 배포 인프라 등 제3자 서비스를 이용할 수
          있습니다. 대표적으로 지도 SDK, 인증 서비스, Google AdSense, Vercel과 같은 도구가 포함될
          수 있습니다.
        </p>
        <p>
          각 제3자 서비스는 자체 정책에 따라 정보를 처리할 수 있으며, 사용자는 해당 서비스의 정책도
          함께 확인하는 것이 좋습니다.
        </p>
      </Section>

      <Section title="5. 사용자 권리와 문의">
        <p>
          사용자는 브라우저 저장소 삭제, 위치 권한 해제, 광고 동의 변경 등을 통해 자신의 데이터
          사용 범위를 조정할 수 있습니다. 서비스 운영 정책이나 개인정보 처리에 대한 문의는 문의
          안내 페이지를 통해 확인할 수 있습니다.
        </p>
      </Section>

      <Section title="6. 시행일">
        <p>본 방침은 사이트에 게시된 시점부터 적용됩니다. 정책 변경 시 본 페이지를 통해 고지합니다.</p>
      </Section>
    </InfoPageLayout>
  );
}
