from __future__ import annotations

import json
import re
from pathlib import Path
from shutil import copy2
from typing import Any

from PIL import Image


WORKSPACE = Path(__file__).resolve().parents[3]
PROJECT = WORKSPACE / "matpick_all"
CARD_ROOT = WORKSPACE / "카드데이터" / "인기맛집"
PUBLIC_DIR = PROJECT / "client" / "public" / "card-data" / "popular-restaurants"
TOPIC_JSON = PROJECT / "client" / "src" / "data" / "generated" / "topic-enrichments" / "popular-restaurants.enriched.json"
MAP_COLLECTIONS_TS = PROJECT / "client" / "src" / "data" / "mapCollections.ts"
SOURCE_THUMBNAIL = PROJECT / "client" / "src" / "assets" / "source-thumbnails" / "popular-restaurants.png"
DESKTOP_THUMBNAIL = Path.home() / "Desktop" / "인간vs맛집.png"


def slugify_file_name(value: str) -> str:
    normalized = value.lower()
    normalized = re.sub(r"[^a-z0-9가-힣]+", "-", normalized)
    normalized = normalized.strip("-")
    return normalized or "image"


def save_public_image(source: Path, slug: str) -> str:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    png_path = PUBLIC_DIR / f"{slug}.png"
    webp_path = PUBLIC_DIR / f"{slug}.webp"

    image = Image.open(source).convert("RGB")
    image.save(png_path, format="PNG", optimize=True)
    image.save(webp_path, format="WEBP", quality=92, method=6)
    return f"/card-data/popular-restaurants/{slug}.webp"


def save_source_thumbnail() -> str:
    if not DESKTOP_THUMBNAIL.exists():
        existing_public_thumbnail = PUBLIC_DIR / "human-vs-matpick-thumbnail.webp"
        if existing_public_thumbnail.exists():
            return "/card-data/popular-restaurants/human-vs-matpick-thumbnail.webp"
        if SOURCE_THUMBNAIL.exists():
            return save_public_image(SOURCE_THUMBNAIL, "human-vs-matpick-thumbnail")
        raise FileNotFoundError(DESKTOP_THUMBNAIL)

    SOURCE_THUMBNAIL.parent.mkdir(parents=True, exist_ok=True)
    copy2(DESKTOP_THUMBNAIL, SOURCE_THUMBNAIL)
    return save_public_image(DESKTOP_THUMBNAIL, "human-vs-matpick-thumbnail")


def load_existing_restaurants() -> dict[str, dict[str, Any]]:
    if not TOPIC_JSON.exists():
        return {}

    data = json.loads(TOPIC_JSON.read_text(encoding="utf-8"))
    return {restaurant["id"]: restaurant for restaurant in data.get("restaurants", [])}


EPISODES = [
    {
        "episode": 1,
        "folder": "Ep.1 인기맛집 홍대라멘 맛집 BEST4",
        "slug": "popular-hongdae-ramen-best4",
        "title": "EP1 홍대 라멘 맛집 BEST4",
        "shortTitle": "홍대 라멘 BEST4",
        "eyebrow": "진한 국물 라멘으로 먼저 떠오르는 코스",
        "description": "홍대와 연남동 근처에서 라멘으로 고르기 좋은 인기 맛집 4곳입니다.",
        "areaLabel": "홍대",
        "purposeTags": ["홍대", "라멘", "일식"],
        "regionKeywords": ["홍대", "연남", "마포"],
        "cuisineKeywords": ["라멘", "일식"],
        "mainFile": "메인.png",
        "mainSlug": "hongdae-ramen-main",
        "palette": {
            "background": "linear-gradient(145deg, #2d211c 0%, #6f3a29 48%, #f17b55 100%)",
            "accent": "#ff8c66",
        },
        "restaurants": [
            {"id": "popular_restaurants_hongdae_hakata_bunko", "slug": "hongdae-hakata-bunko", "file": "1.png", "ordinal": 1, "note": "진한 돈코츠 국물과 얇은 면발이 특징인 홍대 터줏대감 하카타식 라멘 맛집입니다."},
            {"id": "popular_restaurants_hongdae_itsumo_ramen", "slug": "hongdae-itsumo-ramen", "file": "2.png", "ordinal": 2, "note": "돈코츠라멘과 매운라멘을 함께 고를 수 있는 홍대 라멘 맛집입니다."},
            {"id": "popular_restaurants_hongdae_566_ramen", "slug": "hongdae-566-ramen", "file": "3.png", "ordinal": 3, "note": "숙주와 양배추를 산처럼 쌓아 올린 지로계 라멘으로 알려진 연남동 맛집입니다."},
            {"id": "popular_restaurants_hongdae_sarukame", "slug": "hongdae-sarukame", "file": "4.png", "ordinal": 4, "note": "바지락과 차슈를 올린 깔끔한 간장 베이스 창작 라멘 맛집입니다."},
        ],
    },
    {
        "episode": 2,
        "folder": "Ep2. 강남 돈가스 맛집",
        "slug": "popular-gangnam-tonkatsu-best3",
        "title": "EP2 강남 돈가스 맛집 BEST3",
        "shortTitle": "강남 돈가스 BEST3",
        "eyebrow": "강남에서 바삭한 카츠가 생각날 때",
        "description": "강남과 압구정 근처에서 돈가스로 고르기 좋은 인기 맛집 3곳입니다.",
        "areaLabel": "강남",
        "purposeTags": ["돈가스", "일식", "강남"],
        "regionKeywords": ["강남", "역삼", "압구정", "논현"],
        "cuisineKeywords": ["돈가스", "돈카츠", "일식"],
        "mainFile": "메인.png",
        "mainSlug": "gangnam-tonkatsu-main",
        "palette": {
            "background": "linear-gradient(145deg, #1f1f1f 0%, #5a2b2b 52%, #ff6b74 100%)",
            "accent": "#ff6b74",
        },
        "restaurants": [
            {"id": "popular_restaurants_gangnam_just_katsu", "slug": "gangnam-just-katsu", "file": "1. 저스트카츠.png", "ordinal": 1, "note": "멘치카츠와 카츠산도까지 챙기는 논현 골목 카츠입니다."},
            {"id": "popular_restaurants_gangnam_katsuwang", "slug": "gangnam-katsuwang", "file": "2. 카츠왕.png", "ordinal": 2, "note": "강남역에서 빠르게 고르는 든든한 돈카츠 정식입니다."},
            {
                "id": "popular_restaurants_gangnam_katsu_by_konban",
                "slug": "gangnam-katsu-by-konban",
                "file": "3. 카츠바이콘반.png",
                "ordinal": 3,
                "note": "상로스카츠 한 점으로 기억나는 압구정 카츠입니다.",
                "data": {
                    "menus": [
                        {"name": "상로스카츠", "price": "19,000원", "isSignature": True},
                        {"name": "로스카츠", "price": "17,000원"},
                        {"name": "히레카츠", "price": "19,000원"},
                    ],
                },
            },
        ],
    },
    {
        "episode": 3,
        "folder": "Ep.3 인기맛집 대학로 떡볶이 BEST3",
        "slug": "popular-daehakro-tteokbokki-best3",
        "title": "EP3 대학로 떡볶이 맛집 BEST3",
        "shortTitle": "대학로 떡볶이 BEST3",
        "eyebrow": "대학로에서 가볍게 먹고 싶을 때",
        "description": "대학로와 혜화 근처에서 즉석떡볶이와 분식으로 고르기 좋은 인기 맛집 3곳입니다.",
        "areaLabel": "대학로",
        "purposeTags": ["대학로", "떡볶이", "분식"],
        "regionKeywords": ["대학로", "혜화", "종로"],
        "cuisineKeywords": ["떡볶이", "분식"],
        "mainFile": "메인.png",
        "mainSlug": "daehakro-tteokbokki-main",
        "palette": {
            "background": "linear-gradient(145deg, #251f3b 0%, #6b4ab3 48%, #ff93a7 100%)",
            "accent": "#ff93a7",
        },
        "restaurants": [
            {"id": "popular_restaurants_daehakro_bongjju_tteokbokki", "slug": "daehakro-bongjju-tteokbokki", "file": "1.png", "ordinal": 1, "note": "라면사리와 어묵이 어우러진 진한 국물 즉석떡볶이 맛집입니다."},
            {"id": "popular_restaurants_daehakro_nanumi_tteokbokki", "slug": "daehakro-nanumi-tteokbokki", "file": "2.png", "ordinal": 2, "note": "쫄깃한 쌀떡과 꾸덕한 빨간 양념이 살아있는 대학로 대표 떡볶이 맛집입니다."},
            {"id": "popular_restaurants_daehakro_koyako", "slug": "daehakro-koyako", "file": "3.png", "ordinal": 3, "note": "치즈와 햄, 소시지가 듬뿍 올라간 즉석떡볶이로 알려진 대학로 맛집입니다."},
        ],
    },
    {
        "episode": 4,
        "folder": "Ep.4 영등포 짬뽕 맛집",
        "slug": "popular-yeongdeungpo-jjamppong-best4",
        "title": "EP4 영등포 짬뽕 맛집 BEST4",
        "shortTitle": "영등포 짬뽕 BEST4",
        "eyebrow": "불향 있는 국물이 당기는 날",
        "description": "영등포 노포부터 매운맛까지 짬뽕으로 비교해보기 좋은 인기 맛집 4곳입니다.",
        "areaLabel": "영등포",
        "purposeTags": ["짬뽕", "중식", "매운맛"],
        "regionKeywords": ["영등포", "문래", "신길"],
        "cuisineKeywords": ["짬뽕", "중식"],
        "mainFile": "메인.png",
        "mainSlug": "yeongdeungpo-jjamppong-main",
        "palette": {
            "background": "linear-gradient(145deg, #260707 0%, #7b1711 52%, #ff4236 100%)",
            "accent": "#ff4236",
        },
        "restaurants": [
            {"id": "popular_restaurants_yeongdeungpo_songjukjang", "slug": "yeongdeungpo-songjukjang", "file": "1. 송죽장.png", "ordinal": 1, "note": "영등포 노포 분위기에서 만나는 얼큰한 기본기입니다."},
            {"id": "popular_restaurants_yeongdeungpo_shinchai", "slug": "yeongdeungpo-shinchai", "file": "2. 신차이.png", "ordinal": 2, "note": "타임스퀘어 쇼핑 뒤 소룡포와 같이 먹기 좋은 짬뽕입니다."},
            {"id": "popular_restaurants_yeongdeungpo_dongsungak", "slug": "yeongdeungpo-dongsungak", "file": "3. 동순각.png", "ordinal": 3, "note": "짜장과 짬뽕을 같이 떠올리게 하는 동네 중식 한 끼입니다."},
            {"id": "popular_restaurants_yeongdeungpo_singil_spicy_jjamppong", "slug": "yeongdeungpo-singil-spicy-jjamppong", "file": "4. 신길동 매운짬뽕.png", "ordinal": 4, "note": "매운맛 각오하고 가는 신길동 대표 도전 짬뽕입니다."},
        ],
    },
    {
        "episode": 5,
        "folder": "Ep5. 수원 통닭 맛집",
        "slug": "popular-suwon-chicken-best4",
        "title": "EP5 수원 통닭 맛집 BEST4",
        "shortTitle": "수원 통닭 BEST4",
        "eyebrow": "수원 통닭거리에서 먼저 고를 곳",
        "description": "수원 통닭거리와 행궁 근처에서 고르기 좋은 통닭 맛집 4곳입니다.",
        "areaLabel": "수원",
        "purposeTags": ["통닭", "치킨", "수원"],
        "regionKeywords": ["수원", "팔달", "행궁"],
        "cuisineKeywords": ["통닭", "치킨"],
        "mainFile": "메인.png",
        "mainSlug": "suwon-chicken-main",
        "palette": {
            "background": "linear-gradient(145deg, #21140b 0%, #8c431d 52%, #ff7c2e 100%)",
            "accent": "#ff7c2e",
        },
        "restaurants": [
            {"id": "popular_restaurants_suwon_jinmi_chicken", "slug": "suwon-jinmi-chicken", "file": "1. 진미통닭.png", "ordinal": 1, "note": "수원 통닭거리에서 먼저 떠오르는 바삭한 후라이드입니다."},
            {"id": "popular_restaurants_suwon_maehyang_chicken", "slug": "suwon-maehyang-chicken", "file": "2. 매향통닭.png", "ordinal": 2, "note": "반반과 갈비통닭까지 고르는 통닭거리 선택지입니다."},
            {"id": "popular_restaurants_suwon_jangan_chicken", "slug": "suwon-jangan-chicken", "file": "3. 장안통닭.png", "ordinal": 3, "note": "왕갈비와 마늘통닭으로 취향이 갈리는 수원 노포입니다."},
            {"id": "popular_restaurants_suwon_haenggung_chicken", "slug": "suwon-haenggung-chicken", "file": "4. 행궁통닭.png", "ordinal": 4, "note": "행궁 산책 뒤 간장·마늘·고추 조합으로 마무리하기 좋습니다."},
        ],
    },
    {
        "episode": 6,
        "folder": "Ep6. 전주 비빔밥 맛집 3선",
        "slug": "popular-jeonju-bibimbap-best3",
        "title": "EP6 전주 비빔밥 맛집 BEST3",
        "shortTitle": "전주 비빔밥 BEST3",
        "eyebrow": "전주에서 첫 끼를 고른다면",
        "description": "전주 여행에서 비빔밥과 한상차림으로 고르기 좋은 인기 맛집 3곳입니다.",
        "areaLabel": "전주",
        "purposeTags": ["비빔밥", "한식", "전주"],
        "regionKeywords": ["전주", "완산", "덕진"],
        "cuisineKeywords": ["비빔밥", "한식"],
        "mainFile": "메인.png",
        "mainSlug": "jeonju-bibimbap-main",
        "palette": {
            "background": "linear-gradient(145deg, #32231b 0%, #9b6341 52%, #ff7b86 100%)",
            "accent": "#ff7b86",
        },
        "restaurants": [
            {"id": "popular_restaurants_jeonju_gajok_hoegwan", "slug": "jeonju-gajok-hoegwan", "file": "1. 가족회관.png", "ordinal": 1, "note": "육회비빔밥으로 전주 한 끼를 시작하기 좋은 곳입니다."},
            {"id": "popular_restaurants_jeonju_seongmidang", "slug": "jeonju-seongmidang", "file": "2.성미당.png", "ordinal": 2, "note": "오래된 전주비빔밥 명가의 정갈한 한 그릇입니다."},
            {"id": "popular_restaurants_jeonju_gogung", "slug": "jeonju-gogung", "file": "3. 고궁.png", "ordinal": 3, "note": "비빔밥과 떡갈비를 한 상으로 묶기 좋은 전주 본점입니다."},
        ],
    },
    {
        "episode": 7,
        "folder": "Ep7. 충북 매운 갈비찜",
        "slug": "popular-cheongju-spicy-galbijjim-best3",
        "title": "EP7 충북 매운 갈비찜 맛집 BEST3",
        "shortTitle": "충북 매운 갈비찜 BEST3",
        "eyebrow": "청주에서 매운 갈비찜이 당기는 날",
        "description": "청주 성안길, 율량동, 봉명동에서 매운 갈비찜으로 고르기 좋은 인기 맛집 3곳입니다.",
        "areaLabel": "청주",
        "purposeTags": ["청주", "매운갈비찜", "한식"],
        "regionKeywords": ["청주", "충북", "성안길", "율량동", "봉명동"],
        "cuisineKeywords": ["매운갈비찜", "갈비찜", "한식"],
        "mainFile": "청주 메인.png",
        "mainSlug": "cheongju-spicy-galbijjim-main",
        "palette": {
            "background": "linear-gradient(145deg, #25110c 0%, #7d241a 52%, #ff5b3f 100%)",
            "accent": "#ff5b3f",
        },
        "restaurants": [
            {
                "id": "popular_restaurants_cheongju_hwang_grandma_galbijip",
                "slug": "cheongju-hwang-grandma-galbijip",
                "file": "1. 황할머니갈비집.png",
                "ordinal": 1,
                "note": "성안길에서 오래 사랑받은 매콤 돼지갈비찜 대표 맛집입니다.",
                "data": {
                    "name": "황할머니갈비집 청주성안길본점",
                    "region": "충북 청주",
                    "address": "충북 청주시 상당구 남사로140번길 30",
                    "category": "한식",
                    "representativeMenu": "매콤 돼지갈비찜 / 궁중 돼지갈비찜 / 볶음밥",
                    "lat": 36.630433,
                    "lng": 127.4902387,
                    "foundingYear": 1976,
                    "menus": [
                        {"name": "매콤 돼지갈비찜 소(2인분)", "price": "28,000원", "isSignature": True},
                        {"name": "매콤 돼지갈비찜 중(3인분)", "price": "39,000원"},
                        {"name": "궁중 돼지갈비찜 소(2인분)", "price": "28,000원"},
                        {"name": "볶음밥", "price": "2,000원"},
                    ],
                },
            },
            {
                "id": "popular_restaurants_cheongju_changsu_spicy_galbijjim",
                "slug": "cheongju-changsu-spicy-galbijjim",
                "file": "2. 창수네으뜸매운갈비찜.png",
                "ordinal": 2,
                "note": "율량동에서 등갈비 매운갈비찜 단일 메뉴로 알려진 노포입니다.",
                "data": {
                    "name": "창수네으뜸매운갈비찜",
                    "region": "충북 청주",
                    "address": "충북 청주시 청원구 율봉로175번길 10-8",
                    "category": "한식",
                    "representativeMenu": "매운갈비찜 / 치즈볶음밥 / 공기밥",
                    "lat": 36.6713805,
                    "lng": 127.4893507,
                    "foundingYear": None,
                    "menus": [
                        {"name": "매운갈비찜(2인분)", "price": "28,000원", "isSignature": True},
                        {"name": "치즈볶음밥", "price": "3,500원"},
                        {"name": "공기밥", "price": "1,000원"},
                    ],
                },
            },
            {
                "id": "popular_restaurants_cheongju_ttabong_sikdang",
                "slug": "cheongju-ttabong-sikdang",
                "file": "3. 따봉식당.png",
                "ordinal": 3,
                "note": "봉명동에서 매운갈비찜과 집밥 메뉴로 함께 찾기 좋은 식당입니다.",
                "data": {
                    "name": "따봉식당",
                    "region": "충북 청주",
                    "address": "충북 청주시 흥덕구 봉명로 219 1층",
                    "category": "한식",
                    "representativeMenu": "매운갈비찜 / 백반정식 / 제육정식",
                    "lat": 36.6382616,
                    "lng": 127.4539319,
                    "foundingYear": None,
                    "menus": [
                        {"name": "매운갈비찜", "isSignature": True},
                        {"name": "백반정식", "price": "8,000원"},
                        {"name": "제육정식"},
                    ],
                },
            },
        ],
    },
]


def build_menu_items(restaurant_id: str, menus: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "id": f"{restaurant_id}_menu_{index}",
            **menu,
        }
        for index, menu in enumerate(menus, start=1)
    ]


def build_dataset() -> dict[str, Any]:
    existing = load_existing_restaurants()
    source_image = save_source_thumbnail()

    restaurants: list[dict[str, Any]] = []
    source_links: list[dict[str, Any]] = []
    collections: list[dict[str, Any]] = []

    for episode in EPISODES:
        episode_dir = CARD_ROOT / episode["folder"]
        if not episode_dir.exists():
            raise FileNotFoundError(episode_dir)

        main_image_url = save_public_image(episode_dir / episode["mainFile"], episode["mainSlug"])
        restaurant_ids: list[str] = []
        card_image_urls = [main_image_url]

        for item in episode["restaurants"]:
            restaurant_id = item["id"]
            image_url = save_public_image(episode_dir / item["file"], item["slug"])
            restaurant_ids.append(restaurant_id)
            card_image_urls.append(image_url)

            base = dict(existing.get(restaurant_id, {}))
            extra = item.get("data", {})

            restaurant = {
                **base,
                **extra,
                "id": restaurant_id,
                "imageUrl": image_url,
            }

            if "menus" in extra:
                restaurant["menus"] = build_menu_items(restaurant_id, extra["menus"])

            restaurants.append(restaurant)
            source_links.append(
                {
                    "id": f"popular_restaurants_ep{episode['episode']}_{item['ordinal']}",
                    "restaurantId": restaurant_id,
                    "sourceId": "popular-restaurants",
                    "ordinal": item["ordinal"],
                    "label": f"EP.{episode['episode']}",
                    "note": item["note"],
                }
            )

        collections.append(
            {
                "slug": episode["slug"],
                "title": episode["title"],
                "shortTitle": episode["shortTitle"],
                "eyebrow": episode["eyebrow"],
                "description": episode["description"],
                "areaLabel": episode["areaLabel"],
                "purposeTags": episode["purposeTags"],
                "targetCount": len(restaurant_ids),
                "restaurantIds": restaurant_ids,
                "regionKeywords": episode["regionKeywords"],
                "cuisineKeywords": episode["cuisineKeywords"],
                "imageUrl": main_image_url,
                "cardImageUrls": card_image_urls,
                "palette": episode["palette"],
            }
        )

    dataset = {
        "datasetId": "popular-restaurants",
        "generatedAt": "2026-05-25T00:00:00+09:00",
        "sources": [
            {
                "id": "popular-restaurants",
                "name": "인기맛집",
                "type": "guide",
                "provider": "Matpick",
                "description": "맛픽에서 지역과 음식 주제별로 묶은 인기 맛집 카드 리스트입니다.",
                "imageUrl": source_image,
            }
        ],
        "restaurants": restaurants,
        "sourceLinks": source_links,
    }

    return dataset, collections


def write_topic_json(dataset: dict[str, Any]) -> None:
    TOPIC_JSON.write_text(
        json.dumps(dataset, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def format_ts_value(value: Any, indent: int = 2) -> str:
    text = json.dumps(value, ensure_ascii=False, indent=2)
    text = re.sub(r'"([A-Za-z_][A-Za-z0-9_]*)":', r"\1:", text)
    return "\n".join((" " * indent) + line if line else line for line in text.splitlines())


def write_map_collections(collections: list[dict[str, Any]]) -> None:
    source = MAP_COLLECTIONS_TS.read_text(encoding="utf-8")
    start = source.index("export const featuredMapCollections: MapCollectionTopic[] = [")
    end = source.index("];", start) + 2
    prefix = source[:start]
    suffix = source[end:]

    collection_text = ",\n".join(format_ts_value(collection, 2) for collection in collections)
    next_source = (
        f"{prefix}export const featuredMapCollections: MapCollectionTopic[] = [\n"
        f"{collection_text}\n"
        f"];\n{suffix.lstrip()}"
    )
    MAP_COLLECTIONS_TS.write_text(next_source, encoding="utf-8")


def main() -> None:
    dataset, collections = build_dataset()
    write_topic_json(dataset)
    write_map_collections(collections)
    print(f"Imported {len(collections)} popular episodes")
    print(f"Imported {len(dataset['restaurants'])} restaurants")


if __name__ == "__main__":
    main()
