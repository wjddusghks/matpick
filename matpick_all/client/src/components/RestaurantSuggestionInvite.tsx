import { ArrowUpRight, MapPin, Plus } from "lucide-react";
import { Link } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";

export default function RestaurantSuggestionInvite() {
  const { isEnglish } = useLocale();
  return (
    <Link
      href="/suggest"
      className="group mt-7 flex w-full items-center gap-4 rounded-[24px] border border-[#f4ccd2] bg-[linear-gradient(110deg,#fff5f4,#fffaf3)] p-5 text-left shadow-[0_5px_20px_rgba(136,62,73,.04)] transition hover:border-[#e7778d] hover:shadow-[0_8px_28px_rgba(136,62,73,.1)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#c64a67] sm:mt-9 sm:gap-5 sm:px-7 sm:py-6"
    >
      <span
        className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#f4d6d6] bg-white text-[#ce506b] sm:h-14 sm:w-14"
        aria-hidden="true"
      >
        <MapPin size={25} strokeWidth={1.8} />
        <Plus
          size={17}
          className="absolute -bottom-1 -right-1 rounded-full bg-[#ce506b] p-0.5 text-white"
        />
      </span>
      <span className="min-w-0 flex-1">
        <span className="mb-1 block text-[11px] font-bold tracking-wider text-[#b3455e]">
          {isEnglish ? "YOUR PICK, OUR MAP" : "함께 채우는 맛픽 지도"}
        </span>
        <span className="block break-keep text-[16px] font-extrabold leading-6 text-[#35292e] sm:text-[20px]">
          {isEnglish
            ? "Know a place worth sharing?"
            : "나만 알기 아까운 맛집, 알려주세요"}
        </span>
        <span className="mt-1.5 block break-keep text-xs leading-5 text-[#806a72] sm:text-sm">
          {isEnglish
            ? "No photos or sign-in needed. Share what you know."
            : "사진 없이, 로그인 없이. 아는 만큼만 적어 주세요."}
        </span>
      </span>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ce506b] text-white transition group-hover:bg-[#b44058] sm:h-11 sm:w-auto sm:gap-2 sm:px-5">
        <span className="hidden text-sm font-bold sm:inline">
          {isEnglish ? "Suggest a place" : "맛집 제보"}
        </span>
        <ArrowUpRight size={19} aria-hidden="true" />
      </span>
    </Link>
  );
}
