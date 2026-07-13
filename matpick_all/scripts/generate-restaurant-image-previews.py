from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "client" / "src" / "data"
CARD_ROOT = PROJECT_ROOT / "client" / "public" / "card-data"
PREVIEW_ROOT = PROJECT_ROOT / "client" / "public" / "restaurant-image-previews"
MANIFEST_PATH = DATA_ROOT / "generated" / "restaurant-image-previews.json"

PREVIEW_WIDTH = 512
PREVIEW_QUALITY = 76
DATA_FILES = [
    DATA_ROOT / "matpick-data.json",
    DATA_ROOT / "generated" / "old-korean-100.generated.json",
    DATA_ROOT / "generated" / "sikgaek-baekban-trip.generated.json",
    DATA_ROOT / "generated" / "wednesday-gourmet.generated.json",
    *sorted((DATA_ROOT / "generated" / "topic-enrichments").glob("*.json")),
]


def load_image_urls() -> list[str]:
    image_urls: set[str] = set()

    for data_file in DATA_FILES:
        if not data_file.is_file():
            continue

        with data_file.open("r", encoding="utf-8-sig") as stream:
            dataset = json.load(stream)

        for restaurant in dataset.get("restaurants", []):
            image_url = str(restaurant.get("imageUrl") or "").strip()
            if not image_url.startswith("/card-data/"):
                continue

            source_path = CARD_ROOT / Path(image_url.removeprefix("/card-data/"))
            if source_path.is_file():
                image_urls.add(image_url)

    return sorted(image_urls)


def render_preview(source_path: Path, target_path: Path) -> None:
    target_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(source_path) as source_image:
        image = ImageOps.exif_transpose(source_image).convert("RGB")
        if image.width > PREVIEW_WIDTH:
            target_height = round(image.height * PREVIEW_WIDTH / image.width)
            image = image.resize((PREVIEW_WIDTH, target_height), Image.Resampling.LANCZOS)

        image.save(target_path, format="WEBP", quality=PREVIEW_QUALITY, method=6)


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
    manifest: dict[str, str] = {}
    expected_paths: set[Path] = set()

    for image_url in load_image_urls():
        relative_path = Path(image_url.removeprefix("/card-data/")).with_suffix(".webp")
        source_path = CARD_ROOT / Path(image_url.removeprefix("/card-data/"))
        target_path = PREVIEW_ROOT / relative_path

        render_preview(source_path, target_path)
        expected_paths.add(target_path)
        manifest[image_url] = f"/restaurant-image-previews/{relative_path.as_posix()}"

    remove_stale_previews(expected_paths)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(manifest)} restaurant image previews at {PREVIEW_ROOT}")


if __name__ == "__main__":
    main()
