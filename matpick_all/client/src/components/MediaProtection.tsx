import { useEffect } from "react";

const PROTECTED_IMAGE_SELECTOR = [
  'img[src*="/card-data/"]',
  'img[src*="/restaurant-image-previews/"]',
  'img[src*="/source-covers/"]',
  'img[src*="/baekjong-wok/"]',
  'img[src*="/michelin/"]',
  'img[src*="/old-korean-100/"]',
  'img[src*="/popular-restaurants/"]',
  'img[src*="/ttoganjip/"]',
].join(",");

function getProtectedImage(target: EventTarget | null) {
  return target instanceof Element
    ? target.closest<HTMLImageElement>(PROTECTED_IMAGE_SELECTOR)
    : null;
}

export default function MediaProtection() {
  useEffect(() => {
    const disableImageAction = (event: Event) => {
      if (getProtectedImage(event.target)) {
        event.preventDefault();
      }
    };

    document.addEventListener("contextmenu", disableImageAction);
    document.addEventListener("dragstart", disableImageAction);

    return () => {
      document.removeEventListener("contextmenu", disableImageAction);
      document.removeEventListener("dragstart", disableImageAction);
    };
  }, []);

  return null;
}
