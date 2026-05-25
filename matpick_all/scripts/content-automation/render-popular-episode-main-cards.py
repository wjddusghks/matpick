from pathlib import Path
from shutil import copy2

from PIL import Image, ImageDraw, ImageFont, ImageFilter


WORKSPACE = Path(__file__).resolve().parents[3]
PUBLIC_DIR = WORKSPACE / "matpick_all" / "client" / "public" / "card-data" / "popular-restaurants"
CARD_DATA_DIR = WORKSPACE / "카드데이터"

FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/malgun.ttf")

GENERATED_DIR = (
    Path.home()
    / ".codex"
    / "generated_images"
    / "019e3404-92f5-76a3-b96c-f87c46986626"
)


CARDS = [
    {
        "source": GENERATED_DIR / "ig_07d5dce157f6209c016a12e584bd348191b0e2f955dc442e53.png",
        "slug": "gangnam-tonkatsu",
        "folder": "Ep.2 인기맛집 강남 돈가스 BEST3",
        "badge": "인기맛집 EP.2",
        "hook": "인간 추천 vs AI 추천",
        "title": ["강남 1등", "돈가스", "BEST3"],
        "subtitle": "저스트카츠 · 카츠왕 · 카츠바이콘반",
        "note": "두툼한 카츠부터 정식 조합까지 강남에서 고르기 좋은 코스",
        "accent": (255, 82, 92),
        "secondary": (255, 244, 214),
        "layout": "versus",
    },
    {
        "source": GENERATED_DIR / "ig_07d5dce157f6209c016a12e5f03efc81919a8857a0e93746f2.png",
        "slug": "yeongdeungpo-jjamppong",
        "folder": "Ep.4 인기맛집 영등포 짬뽕 BEST4",
        "badge": "인기맛집 EP.4",
        "hook": "불향 제대로",
        "title": ["영등포", "짬뽕", "BEST4"],
        "subtitle": "송죽장 · 신차이 · 동순각 · 신길동 매운짬뽕",
        "note": "노포 국물부터 매운맛 한 방까지 한 번에 정리",
        "accent": (255, 57, 42),
        "secondary": (255, 229, 73),
        "layout": "heat",
    },
    {
        "source": GENERATED_DIR / "ig_07d5dce157f6209c016a12e65dd5e48191bfab7664517e26cb.png",
        "slug": "suwon-chicken",
        "folder": "Ep.5 인기맛집 수원 통닭 BEST4",
        "badge": "인기맛집 EP.5",
        "hook": "수원 통닭거리",
        "title": ["수원 1등", "치킨", "BEST4"],
        "subtitle": "진미통닭 · 매향통닭 · 장안통닭 · 행궁통닭",
        "note": "바삭한 옛날 통닭을 찾을 때 먼저 보는 리스트",
        "accent": (255, 122, 38),
        "secondary": (255, 246, 220),
        "layout": "thumbnail",
    },
    {
        "source": GENERATED_DIR / "ig_07d5dce157f6209c016a12e6c8962c8191858527a305f0d6f1.png",
        "slug": "jeonju-bibimbap",
        "folder": "Ep.6 인기맛집 전주 1등 맛집 BEST3",
        "badge": "인기맛집 EP.6",
        "hook": "전주에서 첫 끼라면",
        "title": ["전주", "1등 맛집", "BEST3"],
        "subtitle": "가족회관 · 성미당 · 고궁",
        "note": "비빔밥과 한상차림으로 시작하는 전주 대표 코스",
        "accent": (255, 88, 116),
        "secondary": (255, 242, 206),
        "layout": "travel",
    },
]


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def cover(image: Image.Image, width: int, height: int) -> Image.Image:
    source_ratio = image.width / image.height
    target_ratio = width / height

    if source_ratio > target_ratio:
        next_height = height
        next_width = round(height * source_ratio)
    else:
        next_width = width
        next_height = round(width / source_ratio)

    resized = image.resize((next_width, next_height), Image.Resampling.LANCZOS)
    left = (next_width - width) // 2
    top = (next_height - height) // 2
    return resized.crop((left, top, left + width, top + height))


def vertical_gradient(width: int, height: int) -> Image.Image:
    overlay = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = overlay.load()

    for y in range(height):
        top_alpha = 40 if y < height * 0.3 else 0
        bottom_alpha = min(210, int(250 * (y / height) ** 1.8))
        alpha = max(top_alpha, bottom_alpha)
        for x in range(width):
            pixels[x, y] = (0, 0, 0, alpha)

    return overlay


def add_vignette(image: Image.Image) -> Image.Image:
    width, height = image.size
    vignette = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(vignette)
    draw.ellipse((-220, -140, width + 220, height + 180), fill=215)
    vignette = Image.eval(vignette.filter(ImageFilter.GaussianBlur(80)), lambda p: 255 - p)
    dark = Image.new("RGBA", image.size, (0, 0, 0, 150))
    return Image.composite(dark, image, vignette)


def text(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    size: int,
    fill: tuple[int, int, int] | tuple[int, int, int, int],
    bold: bool = True,
    stroke: int = 0,
    stroke_fill: tuple[int, int, int] = (0, 0, 0),
) -> None:
    draw.text(
        xy,
        value,
        font=font(size, bold),
        fill=fill,
        stroke_width=stroke,
        stroke_fill=stroke_fill,
    )


def text_center(
    draw: ImageDraw.ImageDraw,
    y: int,
    value: str,
    size: int,
    fill: tuple[int, int, int],
    stroke: int = 0,
    stroke_fill: tuple[int, int, int] = (0, 0, 0),
) -> None:
    bbox = draw.textbbox((0, 0), value, font=font(size, True), stroke_width=stroke)
    x = (1080 - (bbox[2] - bbox[0])) // 2
    text(draw, (x, y), value, size, fill, True, stroke, stroke_fill)


def rounded_label(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    value: str,
    fill: tuple[int, int, int],
    text_fill: tuple[int, int, int] = (255, 255, 255),
) -> None:
    x, y = xy
    label_font = font(32, True)
    bbox = draw.textbbox((0, 0), value, font=label_font)
    width = bbox[2] - bbox[0] + 54
    draw.rounded_rectangle((x, y, x + width, y + 60), radius=30, fill=fill)
    draw.text((x + 27, y + 11), value, font=label_font, fill=text_fill)


def draw_common_footer(draw: ImageDraw.ImageDraw, spec: dict) -> None:
    accent = spec["accent"]
    draw.ellipse((70, 1196, 142, 1268), fill=accent)
    text(draw, (92, 1208), "M", 31, (255, 255, 255), stroke=0)
    text(draw, (166, 1200), "matpick", 42, (255, 255, 255), stroke=2)
    text(draw, (166, 1254), spec["note"], 27, (255, 240, 240), bold=False, stroke=1)


def render_versus(draw: ImageDraw.ImageDraw, spec: dict) -> None:
    accent = spec["accent"]
    rounded_label(draw, (70, 76), spec["badge"], accent)
    draw.rounded_rectangle((70, 168, 410, 238), radius=22, fill=(255, 255, 255, 235))
    text(draw, (104, 184), "인간 추천", 35, (34, 34, 34))
    draw.rounded_rectangle((438, 168, 778, 238), radius=22, fill=(255, 255, 255, 235))
    text(draw, (472, 184), "AI 추천", 35, accent)

    y = 650
    for line in spec["title"]:
        text(draw, (70, y), line, 110, (255, 255, 255), stroke=8)
        y += 118

    draw.rounded_rectangle((70, 1026, 1010, 1162), radius=34, fill=(255, 255, 255, 232))
    text(draw, (104, 1054), spec["subtitle"], 33, (30, 30, 30))
    text(draw, (104, 1102), spec["hook"], 29, accent)
    draw_common_footer(draw, spec)


def render_heat(draw: ImageDraw.ImageDraw, spec: dict) -> None:
    accent = spec["accent"]
    secondary = spec["secondary"]
    draw.rectangle((0, 0, 1080, 1350), outline=accent, width=14)
    rounded_label(draw, (70, 76), spec["badge"], (255, 255, 255), accent)
    text(draw, (72, 172), spec["hook"], 58, secondary, stroke=5)

    y = 636
    for line in spec["title"]:
        text(draw, (70, y), line, 108, (255, 255, 255), stroke=9)
        y += 112

    draw.rounded_rectangle((70, 1030, 1010, 1166), radius=34, fill=(16, 0, 0, 212), outline=secondary, width=3)
    text(draw, (104, 1058), spec["subtitle"], 31, (255, 255, 255))
    text(draw, (104, 1106), spec["note"], 27, (255, 230, 210), bold=False)
    draw_common_footer(draw, spec)


def render_thumbnail(draw: ImageDraw.ImageDraw, spec: dict) -> None:
    accent = spec["accent"]
    draw.rounded_rectangle((690, 82, 1010, 232), radius=16, fill=(255, 255, 255, 236))
    text(draw, (730, 96), "100만", 76, (220, 0, 0), stroke=3, stroke_fill=(255, 255, 255))
    text(draw, (748, 174), "뷰급", 35, (30, 30, 30))
    rounded_label(draw, (70, 76), spec["badge"], accent)

    y = 704
    for line in spec["title"]:
        text(draw, (68, y), line, 110, (255, 255, 255), stroke=9)
        y += 114

    draw.rounded_rectangle((70, 1040, 1010, 1168), radius=32, fill=(0, 0, 0, 196))
    text(draw, (104, 1066), spec["subtitle"], 31, (255, 255, 255))
    text(draw, (104, 1112), spec["hook"], 29, (255, 230, 190))
    draw_common_footer(draw, spec)


def render_travel(draw: ImageDraw.ImageDraw, spec: dict) -> None:
    accent = spec["accent"]
    secondary = spec["secondary"]
    rounded_label(draw, (70, 76), spec["badge"], accent)
    draw.rounded_rectangle((64, 724, 1016, 1126), radius=38, fill=(*secondary, 232), outline=(255, 255, 255, 190), width=3)

    y = 758
    for line in spec["title"]:
        text(draw, (100, y), line, 96, (44, 31, 22), stroke=2, stroke_fill=(255, 255, 255))
        y += 102

    text(draw, (104, 1076), spec["subtitle"], 32, (82, 45, 34))
    text(draw, (76, 1168), spec["hook"], 44, (255, 255, 255), stroke=4)
    draw_common_footer(draw, spec)


def render_card(spec: dict) -> Image.Image:
    width, height = 1080, 1350
    base = cover(Image.open(spec["source"]).convert("RGBA"), width, height)
    base = Image.alpha_composite(base, vertical_gradient(width, height))
    base = add_vignette(base)
    draw = ImageDraw.Draw(base)

    if spec["layout"] == "versus":
        render_versus(draw, spec)
    elif spec["layout"] == "heat":
        render_heat(draw, spec)
    elif spec["layout"] == "thumbnail":
        render_thumbnail(draw, spec)
    else:
        render_travel(draw, spec)

    return base.convert("RGB")


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    for spec in CARDS:
        if not spec["source"].exists():
            raise FileNotFoundError(spec["source"])

        episode_dir = CARD_DATA_DIR / spec["folder"]
        episode_dir.mkdir(parents=True, exist_ok=True)

        copy2(spec["source"], episode_dir / "background_imagegen_v2.png")

        card = render_card(spec)
        card.save(episode_dir / "메인.png", format="PNG", optimize=True)
        card.save(episode_dir / "메인_imagegen_v2.png", format="PNG", optimize=True)
        card.save(PUBLIC_DIR / f"{spec['slug']}-main.png", format="PNG", optimize=True)
        card.save(PUBLIC_DIR / f"{spec['slug']}-main.webp", format="WEBP", quality=92, method=6)
        print(PUBLIC_DIR / f"{spec['slug']}-main.webp")


if __name__ == "__main__":
    main()
