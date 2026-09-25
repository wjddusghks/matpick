import SocialLoginButtons from "@/components/SocialLoginButtons";
import { useLocale } from "@/contexts/LocaleContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AuthFeatureDialog({
  open,
  onOpenChange,
  redirectTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  redirectTo: string;
}) {
  const { isEnglish } = useLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[28px] border border-[#ffd7de] p-0 shadow-[0_30px_80px_rgba(255,123,131,0.18)] sm:max-w-[480px]">
        <div className="rounded-[28px] bg-[linear-gradient(180deg,#fff7f8_0%,#ffffff_100%)] p-6 sm:p-7">
          <span className="inline-flex rounded-full border border-[#ffd6dc] bg-white px-3 py-1 text-[11px] font-semibold text-[#ff6f80]">
            {isEnglish ? "Continue your review after sign-in" : "작성하던 후기를 이어갈 수 있어요"}
          </span>
          <DialogHeader className="mt-4 space-y-3 text-left">
            <DialogTitle className="text-[26px] font-black leading-tight text-[#181818]">
              {isEnglish ? "Sign in to share your review" : "로그인하고 별점·한 줄 후기를 남겨요"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-6 text-[#6f6f6f]">
              {isEnglish
                ? "Your rating and review are shared with other diners. No photo needed."
                : "다녀온 식당의 별점과 솔직한 후기를 다른 사람과 나눠보세요. 사진은 필요 없어요."}
            </DialogDescription>
          </DialogHeader>
          <SocialLoginButtons redirectTo={redirectTo} className="mt-6" />
          <p className="mt-4 text-xs leading-5 text-[#8a8a8a]">
            {isEnglish
              ? "After signing in, you will return to this restaurant to finish your review."
              : "로그인하면 지금 보던 식당으로 돌아와 작성하던 후기를 이어갈 수 있어요."}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
