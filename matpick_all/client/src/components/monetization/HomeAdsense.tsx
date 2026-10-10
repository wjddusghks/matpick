import { CoupangSlot } from "./MonetizationSlot";
import { useLocale } from "@/contexts/LocaleContext";
import {
  homeCoupangBanner,
  type HomeCoupangPlacement,
} from "@/lib/adConfig";

const copy = {
  discovery: {
    ko: {
      title: "맛집 가기 전, 장보기도 간편하게",
      description: "쿠팡 로켓프레시의 신선식품과 식료품 카테고리로 이동합니다.",
      cta: "로켓프레시에서 장보기",
    },
    en: {
      title: "Make grocery shopping easy before you dine out",
      description: "Visit Coupang Rocket Fresh for fresh food and groceries.",
      cta: "Shop on Rocket Fresh",
    },
  },
  suggestion: {
    ko: {
      title: "집에서 먹을 식재료가 필요하다면",
      description: "쿠팡 로켓프레시의 신선식품과 식료품 카테고리를 확인해 보세요.",
      cta: "로켓프레시에서 장보기",
    },
    en: {
      title: "Need groceries for a meal at home?",
      description: "Visit Coupang Rocket Fresh for fresh food and groceries.",
      cta: "Shop on Rocket Fresh",
    },
  },
  topics: {
    ko: {
      title: "맛집 탐색을 마쳤다면 장보기도 이어서",
      description: "쿠팡 로켓프레시의 신선식품과 식료품 카테고리로 이동합니다.",
      cta: "로켓프레시에서 장보기",
    },
    en: {
      title: "Continue from restaurant discovery to groceries",
      description: "Visit Coupang Rocket Fresh for fresh food and groceries.",
      cta: "Shop on Rocket Fresh",
    },
  },
} as const;

export default function HomeAdsense({
  placement,
}: {
  placement: HomeCoupangPlacement;
}) {
  const { isEnglish } = useLocale();
  const placementCopy = copy[placement][isEnglish ? "en" : "ko"];
  return (
    <aside
      aria-label={isEnglish ? "Advertisement" : "광고"}
      data-home-ad={placement}
      className={`text-left empty:hidden ${
        placement === "suggestion" ? "mt-16 sm:mt-24" : "mt-8 sm:mt-10"
      }`}
    >
      <CoupangSlot
        label={isEnglish ? "Sponsored · Coupang Partners" : "제휴 광고 · 쿠팡 파트너스"}
        placement={`home_${placement}`}
        link={homeCoupangBanner.link}
        useIframe
        title={placementCopy.title}
        description={placementCopy.description}
        cta={placementCopy.cta}
        dynamicBannerId={homeCoupangBanner.id}
        dynamicBannerTemplate={homeCoupangBanner.template}
        dynamicBannerTrackingCode={homeCoupangBanner.trackingCode}
        dynamicBannerWidth={homeCoupangBanner.width}
        dynamicBannerHeight={homeCoupangBanner.height}
      />
    </aside>
  );
}
