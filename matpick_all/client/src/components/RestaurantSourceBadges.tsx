import { useEffect, useRef, useState } from "react";
import { BookOpen, Info, Play, Tv } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getRestaurantSourceBadges } from "@/lib/restaurantSources";

function SourceBadge({
  source,
}: {
  source: ReturnType<typeof getRestaurantSourceBadges>[number];
}) {
  const [open, setOpen] = useState(false);
  const mouseInside = useRef(false);
  const closing = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelClose = () => {
    if (closing.current) clearTimeout(closing.current);
  };
  const show = () => {
    cancelClose();
    setOpen(true);
  };
  const hide = () => {
    cancelClose();
    closing.current = setTimeout(() => setOpen(false), 160);
  };
  useEffect(
    () => () => {
      if (closing.current) clearTimeout(closing.current);
    },
    []
  );
  const Icon =
    source.kind === "tv" ? Tv : source.kind === "video" ? Play : BookOpen;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onPointerEnter={event => {
            if (event.pointerType === "mouse") {
              mouseInside.current = true;
              show();
            }
          }}
          onPointerLeave={event => {
            if (event.pointerType === "mouse") {
              mouseInside.current = false;
              hide();
            }
          }}
          onClick={event => {
            event.preventDefault();
            setOpen(current => (mouseInside.current ? true : !current));
          }}
          aria-label={`${source.name} · ${source.badge} 설명`}
          className="inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-lg border border-[#f0d8de] bg-[#fff5f7] px-2.5 py-1.5 text-left text-[11px] text-[#a83c57] focus-visible:outline-2 focus-visible:outline-[#ef6479]"
        >
          <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" />
          <span className="font-bold">{source.name}</span>
          <span className="shrink-0 text-[10px]">{source.badge}</span>
          <Info aria-hidden className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        onPointerEnter={cancelClose}
        onPointerLeave={hide}
        onOpenAutoFocus={event => event.preventDefault()}
        onCloseAutoFocus={event => event.preventDefault()}
        className="z-[60] w-72 max-w-[calc(100vw-32px)] rounded-2xl border-[#eed9df] bg-white p-4 shadow-xl"
      >
        <p className="text-sm font-bold text-[#292127]">{source.name}</p>
        <p className="mt-2 text-xs leading-6 text-[#75656d]">
          {source.description}
        </p>
      </PopoverContent>
    </Popover>
  );
}

export default function RestaurantSourceBadges({
  id,
  name,
  english = false,
}: {
  id: string;
  name: string;
  english?: boolean;
}) {
  const badges = getRestaurantSourceBadges(id, name, english);
  if (!badges.length) return null;
  return (
    <div
      className="mt-2 flex flex-wrap gap-1.5"
      aria-label={english ? "Featured in" : "소개된 방송·가이드"}
    >
      {badges.map(source => (
        <SourceBadge key={source.id} source={source} />
      ))}
    </div>
  );
}
