import type { ReactNode } from "react";
import InfoPageLayout from "@/components/InfoPageLayout";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

const repoUrl = "https://github.com/wjddusghks/matpick";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold tracking-[-0.03em] text-[#1f1718]">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-[#5f5556] sm:text-[15px]">{children}</div>
    </section>
  );
}

export default function Contact() {
  useSeo({
    title: "문의 안내",
    description:
      "Matpick 서비스 관련 제보, 데이터 수정 요청, 협업 제안, 운영 문의를 보낼 수 있는 안내 페이지입니다.",
    path: "/contact",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: "Matpick 문의 안내",
      url: buildAbsoluteUrl("/contact"),
    },
  });

  return (
    <InfoPageLayout
      eyebrow="Contact"
      title="문의 안내"
      description="서비스 운영, 데이터 수정 제안, 콘텐츠 제휴 문의는 아래 안내를 참고해 전달해 주세요."
    >
      <Section title="문의 가능한 내용">
        <p>다음과 같은 내용을 제보하거나 문의하실 수 있습니다.</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>잘못된 식당명, 주소, 카테고리, 지도 위치 정보 수정 요청</li>
          <li>누락된 출처 정보, 중복 데이터, 잘못 연결된 맛집 제보</li>
          <li>서비스 개선 제안, 접근성 문제, 화면 오류 신고</li>
          <li>콘텐츠 협업, 데이터 제휴, 운영 관련 문의</li>
        </ul>
      </Section>

      <Section title="현재 문의 채널">
        <p>
          현재 Matpick은 공개 저장소를 통해 서비스 구조와 데이터 관리가 이루어지고 있습니다.
          운영 관련 이슈나 수정 제안은 아래 저장소 링크를 통해 전달하실 수 있습니다.
        </p>
        <p>
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#ff7b83] underline decoration-[#ffc5cb] underline-offset-4"
          >
            GitHub 저장소 바로가기
          </a>
        </p>
      </Section>

      <Section title="답변 및 반영 기준">
        <p>
          접수된 문의는 내용의 정확성, 재현 가능성, 서비스 운영 우선순위에 따라 검토됩니다. 모든
          제안에 즉시 답변 또는 반영이 이루어지지 않을 수 있으나, 데이터 정확도와 사용자 경험 개선에
          도움이 되는 내용은 우선적으로 확인합니다.
        </p>
      </Section>
    </InfoPageLayout>
  );
}
