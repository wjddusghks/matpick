import {
  Heart,
  MapPinned,
  MessageSquarePlus,
  Star,
} from "lucide-react";
import SocialLoginButtons from "@/components/SocialLoginButtons";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AuthFeatureMode = "rating" | "review" | "topic";

const contentByMode: Record<
  AuthFeatureMode,
  {
    badge: string;
    title: string;
    description: string;
    benefits: Array<{
      title: string;
      description: string;
      icon: typeof Star;
    }>;
  }
> = {
  rating: {
    badge: "로그인 후 더 편하게 기록할 수 있어요",
    title: "로그인하고 나만의 평점을 남겨보세요",
    description:
      "방문한 식당마다 별점을 저장해 두면 다시 비교하기 쉽고, 저장한 맛집과 함께 나만의 기준으로 관리할 수 있어요.",
    benefits: [
      {
        title: "내 평점 저장",
        description: "식당마다 1점부터 5점까지 기록해 두고 다시 볼 수 있어요.",
        icon: Star,
      },
      {
        title: "찜한 맛집과 함께 관리",
        description: "가보고 싶은 곳과 좋았던 곳을 한 화면에서 정리할 수 있어요.",
        icon: Heart,
      },
      {
        title: "지도에서 다시 찾기",
        description: "평점 남긴 식당을 지도와 상세 페이지에서 바로 이어서 볼 수 있어요.",
        icon: MapPinned,
      },
    ],
  },
  review: {
    badge: "로그인하면 리뷰까지 바로 남길 수 있어요",
    title: "로그인하고 리뷰를 남겨보세요",
    description:
      "맛있었던 메뉴와 분위기, 사진까지 함께 기록하면 나중에 다시 찾을 때 훨씬 편하고 다른 사람에게도 도움이 돼요.",
    benefits: [
      {
        title: "리뷰와 사진 기록",
        description: "먹어본 메뉴와 분위기를 사진과 함께 남겨 둘 수 있어요.",
        icon: MessageSquarePlus,
      },
      {
        title: "내 평점 함께 저장",
        description: "리뷰와 별점을 같이 기록해 식당별 만족도를 쌓아갈 수 있어요.",
        icon: Star,
      },
      {
        title: "저장한 맛집과 연결",
        description: "찜한 식당과 리뷰 남긴 식당을 함께 묶어 다시 보기 편해져요.",
        icon: Heart,
      },
    ],
  },
  topic: {
    badge: "로그인하면 주제별로 맛집을 모아둘 수 있어요",
    title: "로그인하고 주제별로 맛집을 저장해보세요",
    description:
      "데이트, 혼밥, 여행 코스처럼 원하는 주제를 직접 만들고 식당을 나눠 담아두면 나중에 훨씬 빠르게 꺼내볼 수 있어요.",
    benefits: [
      {
        title: "주제 만들기",
        description: "내가 원하는 이름으로 맛집 주제를 여러 개 만들 수 있어요.",
        icon: MessageSquarePlus,
      },
      {
        title: "테마별로 구분",
        description: "아이콘과 컬러를 고를 수 있어서 주제마다 쉽게 구분돼요.",
        icon: Star,
      },
      {
        title: "탐색 화면에서 바로 보기",
        description: "저장한 주제를 필터처럼 눌러서 모아둔 식당만 다시 볼 수 있어요.",
        icon: MapPinned,
      },
    ],
  },
};

function BenefitCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Star;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-[22px] border border-[#ffe2e6] bg-[#fff9fa] px-4 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff0f3] text-[#ff7483]">
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-sm font-semibold text-[#1f1f1f]">{title}</p>
      <p className="mt-1 text-xs leading-5 text-[#7f7f7f]">{description}</p>
    </div>
  );
}

export default function AuthFeatureDialog({
  open,
  onOpenChange,
  mode,
  redirectTo,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AuthFeatureMode;
  redirectTo: string;
}) {
  const content = contentByMode[mode];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-1.5rem)] rounded-[28px] border border-[#ffd7de] p-0 shadow-[0_30px_80px_rgba(255,123,131,0.18)] sm:max-w-[560px]">
        <div className="overflow-hidden rounded-[28px] bg-white">
          <div className="bg-[linear-gradient(180deg,#fff7f8_0%,#ffffff_100%)] px-5 pb-6 pt-6 sm:px-7 sm:pt-7">
            <span className="inline-flex rounded-full border border-[#ffd6dc] bg-white px-3 py-1 text-[11px] font-semibold tracking-[0.08em] text-[#ff6f80]">
              {content.badge}
            </span>
            <DialogHeader className="mt-4 space-y-3 text-left">
              <DialogTitle className="text-[26px] font-black leading-tight text-[#181818] sm:text-[30px]">
                {content.title}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-[#6f6f6f] sm:text-[15px]">
                {content.description}
              </DialogDescription>
            </DialogHeader>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {content.benefits.map((benefit) => (
                <BenefitCard
                  key={benefit.title}
                  icon={benefit.icon}
                  title={benefit.title}
                  description={benefit.description}
                />
              ))}
            </div>

            <div className="mt-6 rounded-[24px] border border-[#ffe1e5] bg-white px-4 py-4 sm:px-5">
              <p className="text-sm font-semibold text-[#1f1f1f]">
                지금 로그인하고 이어서 사용해보세요
              </p>
              <p className="mt-1 text-xs leading-5 text-[#8a8a8a]">
                로그인 후에는 지금 보던 식당 페이지로 바로 돌아와서 이어서 평점, 리뷰, 주제 저장을 할 수 있어요.
              </p>
              <SocialLoginButtons redirectTo={redirectTo} className="mt-4" />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
