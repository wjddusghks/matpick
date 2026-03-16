import { Link } from "wouter";

const footerLinks = {
  discover: [
    { href: "/explore", label: "맛집 탐색" },
    { href: "/map", label: "지도 보기" },
    { href: "/about", label: "서비스 소개" },
  ],
  trust: [
    { href: "/privacy", label: "개인정보처리방침" },
    { href: "/terms", label: "이용약관" },
    { href: "/contact", label: "문의 안내" },
  ],
};

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#f1e4e6] bg-[#fffafa]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.3fr,1fr,1fr]">
          <div className="max-w-xl">
            <Link href="/" className="inline-flex items-center gap-2 text-decoration-none">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#ff7b83] text-lg font-black text-white shadow-[0_10px_30px_rgba(255,123,131,0.2)]"
              >
                M
              </span>
              <span className="text-lg font-black tracking-[-0.03em] text-[#1a1a1a]">
                Matpick
              </span>
            </Link>
            <p className="mt-4 text-sm leading-7 text-[#6d6465]">
              Matpick은 크리에이터, 가이드, 방송에서 소개된 맛집을 한곳에서 비교하고
              지도로 찾을 수 있도록 정리한 맛집 탐색 서비스입니다.
            </p>
            <p className="mt-4 text-xs leading-6 text-[#968c8d]">
              일부 콘텐츠와 리뷰 기능은 브라우저 저장소 기반 데모 방식으로 제공되며,
              데이터 출처와 운영 정책은 서비스 소개 및 정책 문서에서 확인할 수 있습니다.
            </p>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[#ff7b83]">
              Discover
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {footerLinks.discover.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[#3a3031] transition hover:text-[#ff7b83]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-sm font-bold uppercase tracking-[0.16em] text-[#ff7b83]">
              Policy
            </h2>
            <div className="mt-4 flex flex-col gap-3">
              {footerLinks.trust.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm font-medium text-[#3a3031] transition hover:text-[#ff7b83]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-[#f1e4e6] pt-5 text-xs text-[#9b9293] sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Matpick. Curated dining discovery for Korea.</p>
          <p>운영 도메인: matpick.co.kr</p>
        </div>
      </div>
    </footer>
  );
}
