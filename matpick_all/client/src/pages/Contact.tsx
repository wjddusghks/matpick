import type { ReactNode } from "react";
import InfoPageLayout from "@/components/InfoPageLayout";
import { useLocale } from "@/contexts/LocaleContext";
import { buildAbsoluteUrl, useSeo } from "@/lib/seo";

const repoUrl = "https://github.com/wjddusghks/matpick";
const instagramUrl = "https://www.instagram.com/matpick.co.kr/";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold tracking-[-0.03em] text-[#1f1718]">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-[#5f5556] sm:text-[15px]">{children}</div>
    </section>
  );
}

export default function Contact() {
  const { isEnglish, locale } = useLocale();
  const page = isEnglish
    ? {
        seoTitle: "Contact",
        seoDescription:
          "Get in touch about Matpick data fixes, partnerships, bug reports, and service feedback.",
        title: "Contact",
        description:
          "Use the channels below for service feedback, data corrections, partnerships, and operational inquiries.",
        section1Title: "What you can report",
        section1Intro: "You can contact us about topics such as:",
        section1Items: [
          "Incorrect restaurant names, addresses, categories, or map positions",
          "Missing source links, duplicate entries, or mismatched restaurant data",
          "Product feedback, accessibility issues, and page errors",
          "Content partnerships, data collaboration, and operational inquiries",
        ],
        section2Title: "Fastest contact route",
        section2Body1:
          "If Matpick information is inaccurate or needs an update, Instagram DM is the fastest way to reach us.",
        section2Body2:
          "For product structure discussions or issue tracking, you can also use the public repository below.",
        section2InstagramLink: "Open Instagram DM",
        section2RepoLink: "Open the GitHub repository",
        section3Title: "How requests are reviewed",
        section3Body1:
          "Submitted requests are reviewed based on accuracy, reproducibility, and current product priorities. Not every request can be answered or applied immediately, but issues that improve data quality and user experience are prioritized.",
      }
    : {
        seoTitle: "문의 안내",
        seoDescription:
          "Matpick 서비스 관련 제보, 데이터 수정 요청, 제휴 제안, 운영 문의를 보낼 수 있는 안내 페이지입니다.",
        title: "문의 안내",
        description:
          "서비스 운영, 데이터 수정 제안, 콘텐츠 제휴 문의는 아래 안내를 참고해 전달해 주세요.",
        section1Title: "문의 가능한 내용",
        section1Intro: "다음과 같은 내용을 제보하거나 문의하실 수 있습니다.",
        section1Items: [
          "잘못된 식당명, 주소, 카테고리, 지도 위치 정보 수정 요청",
          "누락된 출처 정보, 중복 데이터, 잘못 연결된 맛집 제보",
          "서비스 개선 제안, 접근성 문제, 화면 오류 신고",
          "콘텐츠 제휴, 데이터 협업, 운영 관련 문의",
        ],
        section2Title: "가장 빠른 연락 방법",
        section2Body1:
          "맛픽 정보가 정확하지 않거나 업데이트가 필요하다면 Instagram DM이 가장 빠른 문의 채널입니다.",
        section2Body2:
          "제품 구조 논의나 이슈 트래킹이 필요하면 아래 GitHub 저장소도 함께 이용하실 수 있습니다.",
        section2InstagramLink: "인스타그램 DM 열기",
        section2RepoLink: "GitHub 저장소 바로가기",
        section3Title: "검토 및 반영 기준",
        section3Body1:
          "접수된 문의는 내용의 정확성, 재현 가능성, 서비스 운영 우선순위에 따라 검토됩니다. 모든 제안에 즉시 답변하거나 반영하지 못할 수 있지만, 데이터 정확성과 사용자 경험을 높이는 내용은 우선적으로 확인합니다.",
      };

  useSeo({
    title: page.seoTitle,
    description: page.seoDescription,
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
      <Section title={page.section1Title}>
        <p>{page.section1Intro}</p>
        <ul className="list-disc space-y-2 pl-5">
          {page.section1Items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <Section title={page.section2Title}>
        <p>{page.section2Body1}</p>
        <p>
          <a
            href={instagramUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#ff7b83] underline decoration-[#ffc5cb] underline-offset-4"
          >
            {page.section2InstagramLink}
          </a>
        </p>
        <p>{page.section2Body2}</p>
        <p>
          <a
            href={repoUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#ff7b83] underline decoration-[#ffc5cb] underline-offset-4"
          >
            {page.section2RepoLink}
          </a>
        </p>
      </Section>

      <Section title={page.section3Title}>
        <p>{page.section3Body1}</p>
      </Section>
    </InfoPageLayout>
  );
}
