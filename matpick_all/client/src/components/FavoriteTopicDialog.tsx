import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useFavorites } from "@/contexts/FavoritesContext";
import {
  FAVORITE_TOPIC_NAME_LIMIT,
  favoriteTopicColorOptions,
  favoriteTopicIconOptions,
  getFavoriteTopicIconSymbol,
  getFavoriteTopicTone,
  sanitizeFavoriteTopicName,
  type FavoriteTopic,
} from "@/lib/favoriteTopics";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function FavoriteTopicBadge({
  topic,
  active = false,
}: {
  topic: FavoriteTopic;
  active?: boolean;
}) {
  const tone = getFavoriteTopicTone(topic.colorKey);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
        active ? tone.activeButton : tone.badge
      }`}
    >
      <span>{getFavoriteTopicIconSymbol(topic.iconKey)}</span>
      <span className="truncate">{topic.name}</span>
    </span>
  );
}

export default function FavoriteTopicDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { createTopic } = useFavorites();
  const [name, setName] = useState("");
  const [selectedIconKey, setSelectedIconKey] = useState(favoriteTopicIconOptions[0].key);
  const [selectedColorKey, setSelectedColorKey] = useState(favoriteTopicColorOptions[0].key);

  useEffect(() => {
    if (!open) {
      setName("");
      setSelectedIconKey(favoriteTopicIconOptions[0].key);
      setSelectedColorKey(favoriteTopicColorOptions[0].key);
    }
  }, [open]);

  const previewTopic: FavoriteTopic = {
    id: "preview",
    name: sanitizeFavoriteTopicName(name) || "주제 이름",
    iconKey: selectedIconKey,
    colorKey: selectedColorKey,
    createdAt: 0,
  };

  const handleCreate = () => {
    const nextTopic = createTopic({
      name,
      iconKey: selectedIconKey,
      colorKey: selectedColorKey,
    });

    if (!nextTopic) {
      toast("주제 이름을 입력해 주세요.");
      return;
    }

    toast.success(`"${nextTopic.name}" 주제를 만들었어요.`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>주제 만들기</DialogTitle>
          <DialogDescription>
            식당을 모아둘 나만의 주제를 만들어 보세요. 주제 이름은 {FAVORITE_TOPIC_NAME_LIMIT}자까지
            입력할 수 있어요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-[#232323]">주제 이름</label>
            <input
              type="text"
              value={name}
              maxLength={FAVORITE_TOPIC_NAME_LIMIT}
              onChange={(event) => setName(event.target.value)}
              placeholder="예: 데이트 코스"
              className="h-11 w-full rounded-2xl border border-[#f0d7dc] bg-white px-4 text-sm text-[#1d1d1d] outline-none transition focus:border-[#ff7b83] focus:shadow-[0_0_0_3px_rgba(255,123,131,0.12)]"
            />
            <p className="text-right text-xs text-[#999999]">
              {sanitizeFavoriteTopicName(name).length}/{FAVORITE_TOPIC_NAME_LIMIT}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#232323]">아이콘 선택</p>
            <div className="grid grid-cols-3 gap-3">
              {favoriteTopicIconOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedIconKey(option.key)}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-3 text-left transition ${
                    selectedIconKey === option.key
                      ? "border-[#ff7b83] bg-[#fff5f6] text-[#ff6b7b]"
                      : "border-[#ece7e8] bg-white text-[#555555] hover:border-[#ffd2d8]"
                  }`}
                >
                  <span className="text-lg">{option.symbol}</span>
                  <span className="text-sm font-medium">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-[#232323]">테마 컬러</p>
            <div className="grid grid-cols-3 gap-3">
              {favoriteTopicColorOptions.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setSelectedColorKey(option.key)}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-3 text-left transition ${
                    selectedColorKey === option.key
                      ? "border-[#ff7b83] bg-[#fff5f6]"
                      : "border-[#ece7e8] bg-white hover:border-[#ffd2d8]"
                  }`}
                >
                  <span className={`h-4 w-4 rounded-full ${option.swatchClassName}`} />
                  <span className="text-sm font-medium text-[#444444]">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-dashed border-[#ffd5db] bg-[#fffafb] px-4 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#ff7b83]">
              Preview
            </p>
            <FavoriteTopicBadge topic={previewTopic} active />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#e8e2e3] px-5 text-sm font-semibold text-[#666666] transition hover:bg-[#f8f8f8]"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={handleCreate}
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#ff7b83] px-5 text-sm font-semibold text-white transition hover:brightness-95"
          >
            주제 만들기
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
