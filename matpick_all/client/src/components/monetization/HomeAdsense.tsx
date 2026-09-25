import { AdsenseSlot } from "./MonetizationSlot";
import { useLocale } from "@/contexts/LocaleContext";
import { homeAdSlots } from "@/lib/adConfig";

export default function HomeAdsense({
  placement,
}: {
  placement: keyof typeof homeAdSlots;
}) {
  const { isEnglish } = useLocale();
  return (
    <aside
      aria-label={isEnglish ? "Advertisement" : "광고"}
      data-home-ad={placement}
      className="mt-8 text-left empty:hidden sm:mt-10"
    >
      <AdsenseSlot
        label={isEnglish ? "Advertisement" : "광고"}
        slot={homeAdSlots[placement]}
      />
    </aside>
  );
}
