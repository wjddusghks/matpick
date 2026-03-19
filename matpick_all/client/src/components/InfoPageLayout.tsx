import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";

type InfoPageLayoutProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
};

export default function InfoPageLayout({
  eyebrow,
  title,
  description,
  children,
}: InfoPageLayoutProps) {
  const { isEnglish } = useLocale();
  const labels = isEnglish
    ? {
        back: "Go back home",
        information: "Matpick Information",
        about: "About",
        privacy: "Privacy",
        terms: "Terms",
        contact: "Contact",
        home: "Home",
      }
    : {
        back: "홈으로 돌아가기",
        information: "맛픽 안내",
        about: "소개",
        privacy: "개인정보",
        terms: "약관",
        contact: "문의",
        home: "홈",
      };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fff8f8_0%,#ffffff_28%,#ffffff_100%)] text-[#1d1718]">
      <div className="border-b border-[#f2e3e5] bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-[#f3d7db] bg-white text-[#4b3d3f] transition hover:border-[#ffb9c1] hover:text-[#ff7b83]"
              aria-label={labels.back}
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ff7b83]">
                {eyebrow}
              </p>
              <p className="text-sm font-medium text-[#6f6566]">{labels.information}</p>
            </div>
          </div>

          <nav className="hidden items-center gap-5 text-sm font-medium text-[#5b5152] md:flex">
            <Link href="/about" className="transition hover:text-[#ff7b83]">
              {labels.about}
            </Link>
            <Link href="/privacy" className="transition hover:text-[#ff7b83]">
              {labels.privacy}
            </Link>
            <Link href="/terms" className="transition hover:text-[#ff7b83]">
              {labels.terms}
            </Link>
            <Link href="/contact" className="transition hover:text-[#ff7b83]">
              {labels.contact}
            </Link>
          </nav>
        </div>
      </div>

      <main className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="rounded-[32px] border border-[#f3dfe2] bg-white p-8 shadow-[0_20px_70px_rgba(46,20,20,0.06)] sm:p-10 lg:p-12">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[#8a7f80]">
            <Link href="/" className="transition hover:text-[#ff7b83]">
              {labels.home}
            </Link>
            <ChevronRight className="h-4 w-4" />
            <span>{title}</span>
          </div>

          <div className="mt-6 max-w-3xl">
            <p className="text-[12px] font-bold uppercase tracking-[0.2em] text-[#ff7b83]">
              {eyebrow}
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[#1e1617] sm:text-4xl">
              {title}
            </h1>
            <p className="mt-5 text-base leading-8 text-[#6d6465] sm:text-lg">
              {description}
            </p>
          </div>

          <div className="mt-10 space-y-10">{children}</div>
        </div>
      </main>
    </div>
  );
}
