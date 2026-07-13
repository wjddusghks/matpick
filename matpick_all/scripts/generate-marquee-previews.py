from __future__ import annotations

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "client" / "src" / "data"
CARD_ROOT = PROJECT_ROOT / "client" / "public" / "card-data"
PREVIEW_ROOT = PROJECT_ROOT / "client" / "public" / "card-previews"
MANIFEST_PATH = DATA_ROOT / "generated" / "marquee-card-previews.json"

SOURCE_QUOTA = 20
PREVIEW_WIDTH = 512
PREVIEW_QUALITY = 80
SUPPORTED_SOURCE_IDS = {
    "baekjong-wok",
    "michelin",
    "old-korean-100",
    "popular-restaurants",
    "ttoganjip",
}
PINNED_IMAGE_URLS = {
    "/card-data/popular-restaurants/cheongju-hwang-grandma-galbijip.webp",
    "/card-data/popular-restaurants/daehakro-bongjju-tteokbokki.webp",
}
DATA_FILES = [
    DATA_ROOT / "matpick-data.json",
    DATA_ROOT / "generated" / "old-korean-100.generated.json",
    DATA_ROOT / "generated" / "sikgaek-baekban-trip.generated.json",
    DATA_ROOT / "generated" / "wednesday-gourmet.generated.json",
    *sorted((DATA_ROOT / "generated" / "topic-enrichments").glob("*.json")),
]


def load_restaurant_image_urls() -> dict[str, set[str]]:
    urls_by_source = {source_id: set() for source_id in SUPPORTED_SOURCE_IDS}

    for data_file in DATA_FILES:
        with data_file.open("r", encoding="utf-8-sig") as stream:
            dataset = json.load(stream)

        for restaurant in dataset.get("restaurants", []):
            image_url = str(restaurant.get("imageUrl") or "").strip()
            if not image_url.startswith("/card-data/"):
                continue

            relative_path = Path(image_url.removeprefix("/card-data/"))
            if len(relative_path.parts) < 2:
                continue

            source_id = relative_path.parts[0]
            source_path = CARD_ROOT / relative_path
            if source_id in urls_by_source and source_path.is_file():
                urls_by_source[source_id].add(image_url)

    return urls_by_source


def stable_sort_key(image_url: str) -> str:
    return hashlib.sha256(image_url.encode("utf-8")).hexdigest()


def select_image_urls(urls_by_source: dict[str, set[str]]) -> list[str]:
    selected: list[str] = []

    for source_id in sorted(urls_by_source):
        source_urls = urls_by_source[source_id]
        pinned = sorted(source_urls & PINNED_IMAGE_URLS)
        remaining = sorted(source_urls - set(pinned), key=stable_sort_key)
        selected.extend((pinned + remaining)[:SOURCE_QUOTA])

    return selected


def render_preview(source_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source_path) as source_image:
        image = ImageOps.exif_transpose(source_image).convert("RGB")
        if image.width > PREVIEW_WIDTH:
            target_height = round(image.height * PREVIEW_WIDTH / image.width)
            image = image.resize((PREVIEW_WIDTH, target_height), Image.Resampling.LANCZOS)

        image.save(
            target_path,
            format="WEBP",
            quality=PREVIEW_QUALITY,
            method=6,
        )


def remove_stale_previews(expected_paths: set[Path]) -> None:
    if not PREVIEW_ROOT.exists():
        return

    for preview_path in PREVIEW_ROOT.rglob("*.webp"):
        if preview_path not in expected_paths:
            preview_path.unlink()

    for directory in sorted(PREVIEW_ROOT.rglob("*"), reverse=True):
        if directory.is_dir() and not any(directory.iterdir()):
            directory.rmdir()


def main() -> None:
    selected_urls = select_image_urls(load_restaurant_image_urls())
    manifest: dict[str, str] = {}
    expected_paths: set[Path] = set()

    for image_url in selected_urls:
        relative_path = Path(image_url.removeprefix("/card-data/"))
        source_path = CARD_ROOT / relative_path
        target_relative_path = relative_path.with_suffix(".webp")
        target_path = PREVIEW_ROOT / target_relative_path
        render_preview(source_path, target_path)
        expected_paths.add(target_path)
        manifest[image_url] = f"/card-previews/{target_relative_path.as_posix()}"

    remove_stale_previews(expected_paths)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(manifest)} marquee previews at {PREVIEW_ROOT}")


if __name__ == "__main__":
    main()
