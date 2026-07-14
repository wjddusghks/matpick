from __future__ import annotations

import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "client" / "src" / "data"
MARQUEE_PREVIEWS_PATH = DATA_ROOT / "generated" / "marquee-card-previews.json"
HOME_MARQUEE_PATH = DATA_ROOT / "generated" / "home-marquee-restaurant-cards.json"
DATA_FILES = [
    DATA_ROOT / "matpick-data.json",
    DATA_ROOT / "generated" / "old-korean-100.generated.json",
    DATA_ROOT / "generated" / "sikgaek-baekban-trip.generated.json",
    DATA_ROOT / "generated" / "wednesday-gourmet.generated.json",
    *sorted((DATA_ROOT / "generated" / "topic-enrichments").glob("*.json")),
]


def load_json(path: Path) -> object:
    with path.open("r", encoding="utf-8-sig") as stream:
        return json.load(stream)


def load_home_marquee_cards() -> list[dict[str, str]]:
    marquee_previews = load_json(MARQUEE_PREVIEWS_PATH)
    if not isinstance(marquee_previews, dict):
        raise ValueError(f"{MARQUEE_PREVIEWS_PATH} must contain a JSON object")

    seen_image_urls: set[str] = set()
    cards: list[dict[str, str]] = []

    for data_file in DATA_FILES:
        if not data_file.is_file():
            continue

        dataset = load_json(data_file)
        if not isinstance(dataset, dict):
            continue

        restaurants = dataset.get("restaurants", [])
        if not isinstance(restaurants, list):
            continue

        for restaurant in restaurants:
            if not isinstance(restaurant, dict):
                continue

            image_url = str(restaurant.get("imageUrl") or "").strip()
            preview_image_url = marquee_previews.get(image_url)
            if not image_url or not isinstance(preview_image_url, str):
                continue

            if image_url in seen_image_urls:
                continue

            seen_image_urls.add(image_url)
            cards.append(
                {
                    "id": str(restaurant.get("id") or ""),
                    "name": str(restaurant.get("name") or ""),
                    "category": str(restaurant.get("category") or ""),
                    "region": str(restaurant.get("region") or ""),
                    "imageUrl": image_url,
                    "previewImageUrl": preview_image_url,
                }
            )

    return [card for card in cards if card["id"] and card["name"] and card["previewImageUrl"]]


def main() -> None:
    cards = load_home_marquee_cards()
    HOME_MARQUEE_PATH.parent.mkdir(parents=True, exist_ok=True)
    HOME_MARQUEE_PATH.write_text(
        json.dumps(cards, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(cards)} home marquee restaurant cards at {HOME_MARQUEE_PATH}")


if __name__ == "__main__":
    main()
