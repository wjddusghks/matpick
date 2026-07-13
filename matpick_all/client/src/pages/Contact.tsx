import type { ReactNode } from "react";
import InfoPageLayout from "@/components/InfoPageLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

const repoUrl = "https://github.com/wjddusghks/matpick";
const instagramUrl = "https://www.instagram.com/matpick.co.kr/";

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

export default function Contact() {
  const { isEnglish, locale } = useLocale();
  const page = isEnglish
    ? {
        title: "Contact",
        description:
          "Private support for data corrections, privacy rights, content removal, partnerships, and service issues.",
        reportTitle: "What you can report",
        reportItems: [
          "Incorrect restaurant names, addresses, menus, prices, closures, or map positions",
          "Missing sources, duplicate records, broken images, accessibility issues, or page errors",
          "Privacy access, correction, deletion, consent withdrawal, or account deletion requests",
          "Copyright, portrait, trademark, or other content removal requests",
          "Content partnerships, data collaboration, and advertising inquiries",
        ],
        privateTitle: "Private requests",
        privateBody:
          "Use Instagram DM for any request that includes an account, identity, personal data, or evidence of rights. Include the affected URL, the requested action, and enough information for us to verify the request.",
        instagram: "Open Instagram DM",
        publicTitle: "Public issue tracking",
        publicBody:
          "The GitHub repository may be used for reproducible technical bugs that contain no personal or confidential information. GitHub issues are public, so never include account IDs, email addresses, phone numbers, private photos, or identity documents.",
        github: "Open the GitHub repository",
        reviewTitle: "Review process",
        reviewBody:
          "We prioritize privacy, rights, security, and clearly reproducible data errors. Response time depends on verification and scope. We may ask for account-provider details or proof of authority and will retain only what is needed to resolve the request.",
      }
    : {
        title: "문의 안내",
        description:
          "데이터 정정, 개인정보 권리 행사, 콘텐츠 삭제, 제휴 및 서비스 오류를 비공개 채널로 접수할 수 있습니다.",
        reportTitle: "문의 가능한 내용",
        reportItems: [
          "식당명, 주소, 메뉴, 가격, 폐업 여부 또는 지도 위치 정정",
          "누락 출처, 중복 데이터, 깨진 이미지, 접근성 문제 또는 화면 오류",
          "개인정보 열람·정정·삭제·동의 철회 또는 계정 삭제 요청",
          "저작권, 초상권, 상표권 등 권리 침해 및 콘텐츠 삭제 요청",
          "콘텐츠 제휴, 데이터 협업 및 광고 운영 문의",
        ],
        privateTitle: "개인정보·권리 관련 비공개 문의",
        privateBody:
          "계정, 신원, 개인정보 또는 권리 입증 자료가 포함된 요청은 Instagram DM을 이용해 주세요. 대상 URL, 원하는 조치, 요청 권한을 확인할 수 있는 최소한의 정보를 함께 보내면 검토가 빨라집니다.",
        instagram: "Instagram DM 열기",
        publicTitle: "공개 오류 제보",
        publicBody:
          "개인정보나 비공개 자료가 전혀 없는 재현 가능한 기술 오류는 GitHub 저장소에 남길 수 있습니다. GitHub 이슈는 공개되므로 계정 식별값, 이메일, 전화번호, 비공개 사진, 신분증 자료를 절대 올리지 마세요.",
        github: "GitHub 저장소 열기",
        reviewTitle: "검토 및 처리 기준",
        reviewBody:
          "개인정보·권리·보안 요청과 명확히 재현되는 데이터 오류를 우선 검토합니다. 확인 범위에 따라 처리 시간이 달라질 수 있고, 본인 또는 권리자 확인을 위한 추가 정보를 요청할 수 있습니다. 접수 자료는 요청 처리에 필요한 범위에서만 보관합니다.",
      };

  useSeo({
    title: page.title,
    description: page.description,
    path: "/contact",
    locale,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "ContactPage",
      name: `Matpick ${page.title}`,
      url: buildAbsoluteUrl("/contact"),
    },
  });

  return (
    <InfoPageLayout eyebrow="Contact" title={page.title} description={page.description}>
      <Section title={page.reportTitle}>
        <ul className="list-disc space-y-2 pl-5">
          {page.reportItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title={page.privateTitle}>
        <p>{page.privateBody}</p>
        <a
          href={instagramUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center rounded-[8px] bg-[#f45f70] px-4 font-bold text-white no-underline"
        >
          {page.instagram}
        </a>
      </Section>

      <Section title={page.publicTitle}>
        <p>{page.publicBody}</p>
        <a
          href={repoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-[#e75b6c] underline"
        >
          {page.github}
        </a>
      </Section>

      <Section title={page.reviewTitle}>
        <p>{page.reviewBody}</p>
      </Section>
    </InfoPageLayout>
  );
}
