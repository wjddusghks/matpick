import { useMemo, useState } from "react";
import { toast } from "sonner";
import FavoriteTopicDialog, {
  FavoriteTopicBadge,
} from "@/components/FavoriteTopicDialog";
import { useFavorites } from "@/contexts/FavoritesContext";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function FavoriteTopicPickerDialog({
  open,
  onOpenChange,
  restaurantId,
  restaurantName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  restaurantName: string;
}) {
  const { topics, isRestaurantInTopic, toggleRestaurantInTopic } =
    useFavorites();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const assignedTopicIds = useMemo(
    () =>
      topics
        .filter((topic) => isRestaurantInTopic(topic.id, restaurantId))
        .map((topic) => topic.id),
    [isRestaurantInTopic, restaurantId, topics]
  );

  const handleToggleTopic = (topicId: string, topicName: string) => {
    const nextState = toggleRestaurantInTopic(topicId, restaurantId);
    toast.success(
      nextState
        ? `"${restaurantName}"을 "${topicName}"에 담았어요.`
        : `"${topicName}"에서 "${restaurantName}"을 뺐어요.`
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>주제에 담기</DialogTitle>
            <DialogDescription>
              "{restaurantName}"을 담을 주제를 고르세요. 이미 담긴 주제는
              한번 더 누르면 바로 취소할 수 있어요.
            </DialogDescription>
          </DialogHeader>

          {topics.length > 0 ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-[#ffe2e6] bg-[#fff9fa] px-4 py-3 text-xs leading-5 text-[#8a8a8a]">
                주제를 눌러 담기와 취소를 바로 바꿀 수 있어요. 담겨 있는
                항목은 다시 누르면 주제에서 빠집니다.
              </div>
              {topics.map((topic) => {
                const active = assignedTopicIds.includes(topic.id);

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => handleToggleTopic(topic.id, topic.name)}
                    className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                      active
                        ? "border-[#ffb5bf] bg-[#fff7f8]"
                        : "border-[#ece7e8] bg-white hover:border-[#ffd2d8]"
                    }`}
                  >
                    <FavoriteTopicBadge topic={topic} active={active} />
                    <span
                      className={`text-xs font-semibold ${
                        active ? "text-[#ff6b7b]" : "text-[#888888]"
                      }`}
                    >
                      {active ? "한번 더 누르면 취소" : "주제에 담기"}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="rounded-3xl border border-dashed border-[#ffd5db] bg-[#fffafb] px-5 py-6 text-center">
              <p className="text-sm font-semibold text-[#232323]">
                아직 만든 주제가 없어요
              </p>
              <p className="mt-2 text-sm leading-6 text-[#868686]">
                먼저 주제를 하나 만들면 저장한 맛집을 테마별로 정리할 수
                있어요.
              </p>
            </div>
          )}

          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                onOpenChange(false);
                setShowCreateDialog(true);
              }}
              className="inline-flex h-11 items-center justify-center rounded-full border border-[#ffd1d7] bg-[#fff7f8] px-5 text-sm font-semibold text-[#ff6b7b] transition hover:bg-[#fff1f3]"
            >
              주제 만들기
            </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-11 items-center justify-center rounded-full bg-[#ff7b83] px-5 text-sm font-semibold text-white transition hover:brightness-95"
            >
              닫기
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FavoriteTopicDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
      />
    </>
  );
}
