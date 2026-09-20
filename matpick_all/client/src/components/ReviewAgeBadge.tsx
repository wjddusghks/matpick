import { ageGroupLabel, ageGroupHint } from "@/lib/reviewAge";
import type { SharedReview } from "@/lib/reviews";
export default function ReviewAgeBadge({
  review,
  english = false,
}: {
  review: SharedReview;
  english?: boolean;
}) {
  const label = ageGroupLabel(review.ageGroup, english);
  if (
    !label ||
    !review.ageBasis ||
    review.ageConsentVersion !== "review-age-v1"
  )
    return null;
  return (
    <span
      className="rounded-full bg-[#fff0f3] px-2 py-0.5 text-[11px] font-medium text-[#a05267]"
      title={ageGroupHint(review.ageBasis, english)}
      aria-label={`${label} · ${ageGroupHint(review.ageBasis, english)}`}
    >
      {label}
    </span>
  );
}
