from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter


WORKSPACE = Path(__file__).resolve().parents[3]
GENERATED_DIR = Path.home() / ".codex" / "generated_images" / "019e3404-92f5-76a3-b96c-f87c46986626"
PUBLIC_DIR = WORKSPACE / "matpick_all" / "client" / "public" / "card-data" / "popular-restaurants"
CARD_DATA_DIR = WORKSPACE / "카드데이터"

FONT_BOLD = Path("C:/Windows/Fonts/malgunbd.ttf")
FONT_REGULAR = Path("C:/Windows/Fonts/malgun.ttf")


RESTAURANT_CARDS = [
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a121be288191a11927eb4b2665d3.png",
        "folder": "Ep.2 인기맛집 강남 돈가스 BEST3",
        "index": 3,
        "slug": "gangnam-katsu-by-konban",
        "badge": "인기맛집 EP.2",
        "name": "카츠바이콘반",
        "category": "돈가스",
        "menu": "상로스카츠",
        "price": "19,000원",
        "address": "서울 강남구 선릉로153길 36",
        "hook": "상로스카츠 한 점으로 기억나는 압구정 카츠",
        "accent": (255, 112, 122),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a187578c8191973cab124d4e32e0.png",
        "folder": "Ep.2 인기맛집 강남 돈가스 BEST3",
        "index": 2,
        "slug": "gangnam-katsuwang",
        "badge": "인기맛집 EP.2",
        "name": "카츠왕",
        "category": "돈가스",
        "menu": "등심돈카츠",
        "price": "10,500원",
        "address": "서울 강남구 테헤란로4길 6",
        "hook": "강남역에서 빠르게 고르는 든든한 돈카츠 정식",
        "accent": (255, 112, 122),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a1f906e08191be60836deeffc7cd.png",
        "folder": "Ep.2 인기맛집 강남 돈가스 BEST3",
        "index": 1,
        "slug": "gangnam-just-katsu",
        "badge": "인기맛집 EP.2",
        "name": "저스트카츠",
        "category": "돈가스",
        "menu": "등심돈카츠정식",
        "price": "12,500원",
        "address": "서울 강남구 학동로4길 10",
        "hook": "멘치카츠와 카츠산도까지 챙기는 논현 골목 카츠",
        "accent": (255, 112, 122),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a265db38819187d48d70a5ae57e2.png",
        "folder": "Ep.4 인기맛집 영등포 짬뽕 BEST4",
        "index": 1,
        "slug": "yeongdeungpo-songjukjang",
        "badge": "인기맛집 EP.4",
        "name": "송죽장",
        "category": "중식",
        "menu": "짬뽕",
        "price": "10,000원",
        "address": "서울 영등포구 문래로 203",
        "hook": "영등포 노포 분위기에서 만나는 얼큰한 기본기",
        "accent": (255, 92, 92),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a2d9c518819194f206454cde8203.png",
        "folder": "Ep.4 인기맛집 영등포 짬뽕 BEST4",
        "index": 2,
        "slug": "yeongdeungpo-shinchai",
        "badge": "인기맛집 EP.4",
        "name": "신차이",
        "category": "중식",
        "menu": "얼큰해물짬뽕",
        "price": "17,000원",
        "address": "서울 영등포구 영중로 15",
        "hook": "타임스퀘어 쇼핑 뒤 소룡포와 같이 먹기 좋은 짬뽕",
        "accent": (255, 92, 92),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a34e72e881919b78ed0d4edbcb71.png",
        "folder": "Ep.4 인기맛집 영등포 짬뽕 BEST4",
        "index": 3,
        "slug": "yeongdeungpo-dongsungak",
        "badge": "인기맛집 EP.4",
        "name": "동순각",
        "category": "중식",
        "menu": "짬뽕",
        "price": "8,000원",
        "address": "서울 영등포구 영등포로45길 14-5",
        "hook": "짜장과 짬뽕을 같이 떠올리게 하는 동네 중식 한 끼",
        "accent": (255, 92, 92),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a456873c81918230b8848bc697fb.png",
        "folder": "Ep.4 인기맛집 영등포 짬뽕 BEST4",
        "index": 4,
        "slug": "yeongdeungpo-singil-spicy-jjamppong",
        "badge": "인기맛집 EP.4",
        "name": "신길동 매운짬뽕",
        "category": "중식",
        "menu": "매운짬뽕",
        "price": "14,000원",
        "address": "서울 영등포구 영등포로62길 10-1",
        "hook": "매운맛 각오하고 가는 신길동 대표 도전 짬뽕",
        "accent": (255, 92, 92),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a4c9c0088191824e941b70bb94ae.png",
        "folder": "Ep.5 인기맛집 수원 통닭 BEST4",
        "index": 1,
        "slug": "suwon-jinmi-chicken",
        "badge": "인기맛집 EP.5",
        "name": "진미통닭",
        "category": "통닭",
        "menu": "후라이드치킨",
        "price": "18,000원",
        "address": "경기 수원시 팔달구 정조로800번길 21",
        "hook": "수원 통닭거리에서 먼저 떠오르는 바삭한 후라이드",
        "accent": (255, 126, 79),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a53133a08191a64180605511d3e3.png",
        "folder": "Ep.5 인기맛집 수원 통닭 BEST4",
        "index": 2,
        "slug": "suwon-maehyang-chicken",
        "badge": "인기맛집 EP.5",
        "name": "매향통닭",
        "category": "통닭",
        "menu": "후라이드치킨",
        "price": "21,000원",
        "address": "경기 수원시 팔달구 수원천로 317",
        "hook": "반반과 갈비통닭까지 고르는 통닭거리 선택지",
        "accent": (255, 126, 79),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a59c3f248191b2953e41a83afca5.png",
        "folder": "Ep.5 인기맛집 수원 통닭 BEST4",
        "index": 3,
        "slug": "suwon-jangan-chicken",
        "badge": "인기맛집 EP.5",
        "name": "장안통닭",
        "category": "통닭",
        "menu": "후라이드",
        "price": "18,000원",
        "address": "경기 수원시 팔달구 팔달문로3번길 42",
        "hook": "왕갈비와 마늘통닭으로 취향이 갈리는 수원 노포",
        "accent": (255, 126, 79),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a600a7948191827925150aa14862.png",
        "folder": "Ep.5 인기맛집 수원 통닭 BEST4",
        "index": 4,
        "slug": "suwon-haenggung-chicken",
        "badge": "인기맛집 EP.5",
        "name": "행궁통닭",
        "category": "통닭",
        "menu": "후라이드치킨",
        "price": "20,000원",
        "address": "경기 수원시 팔달구 수원천로 291",
        "hook": "행궁 산책 뒤 간장·마늘·고추 조합으로 마무리",
        "accent": (255, 126, 79),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a67428c88191ab38a7a16490f35d.png",
        "folder": "Ep.6 인기맛집 전주 1등 맛집 BEST3",
        "index": 1,
        "slug": "jeonju-gajok-hoegwan",
        "badge": "인기맛집 EP.6",
        "name": "가족회관",
        "category": "비빔밥",
        "menu": "전주비빔밥",
        "price": "15,000원",
        "address": "전북 전주시 완산구 전라감영5길 17",
        "hook": "육회비빔밥으로 전주 한 끼를 시작하기 좋은 곳",
        "accent": (255, 112, 122),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a6fd3c0c8191a4af1ce882d78eee.png",
        "folder": "Ep.6 인기맛집 전주 1등 맛집 BEST3",
        "index": 2,
        "slug": "jeonju-seongmidang",
        "badge": "인기맛집 EP.6",
        "name": "성미당",
        "category": "비빔밥",
        "menu": "전주비빔밥",
        "price": "16,000원",
        "address": "전북 전주시 완산구 전라감영5길 19-9",
        "hook": "오래된 전주비빔밥 명가의 정갈한 한 그릇",
        "accent": (255, 112, 122),
    },
    {
        "bg": "ig_0b9c03f7bf50a7d4016a12a7ebef708191901c78a3d2f7bbf2.png",
        "folder": "Ep.6 인기맛집 전주 1등 맛집 BEST3",
        "index": 3,
        "slug": "jeonju-gogung",
        "badge": "인기맛집 EP.6",
        "name": "고궁",
        "category": "비빔밥",
        "menu": "전주전통비빔밥",
        "price": "14,000원",
        "address": "전북 전주시 덕진구 송천중앙로 33",
        "hook": "비빔밥과 떡갈비를 한 상으로 묶기 좋은 전주 본점",
        "accent": (255, 112, 122),
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
        top_alpha = max(0, 218 - int(y * 0.34))
        bottom_alpha = max(0, int((y - height * 0.60) * 0.45))
        alpha = min(230, max(top_alpha, bottom_alpha, 24))
        for x in range(width):
            pixels[x, y] = (0, 0, 0, alpha)
    return overlay


def wrap_by_width(draw: ImageDraw.ImageDraw, text: str, text_font: ImageFont.FreeTypeFont, max_width: int):
    words = text.split()
    if len(words) > 1:
        lines = []
        current = ""
        for word in words:
            candidate = f"{current} {word}".strip()
            if draw.textbbox((0, 0), candidate, font=text_font)[2] <= max_width:
                current = candidate
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
        return lines

    lines = []
    current = ""
    for char in text:
        candidate = current + char
        if draw.textbbox((0, 0), candidate, font=text_font)[2] <= max_width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = char
    if current:
        lines.append(current)
    return lines


def draw_shadow_text(draw, xy, text, text_font, fill, shadow=(0, 0, 0), offset=4):
    x, y = xy
    draw.text((x + offset, y + offset), text, font=text_font, fill=(*shadow, 165))
    draw.text((x, y), text, font=text_font, fill=fill)


def draw_footer(draw: ImageDraw.ImageDraw, accent: tuple[int, int, int], dark: bool = False) -> None:
    fill = (32, 24, 20) if dark else (255, 255, 255)
    sub_fill = (72, 56, 47) if dark else (255, 235, 235)
    draw.ellipse((88, 1182, 148, 1242), fill=accent)
    draw.text((176, 1188), "Matpick", font=font(42, True), fill=fill)
    draw.text((176, 1238), "위치 · 메뉴 · 가격 한 번에 보기", font=font(24), fill=sub_fill)


def draw_menu_row(draw, spec, x, y, text_fill, price_fill, badge_fill):
    draw.rounded_rectangle((x, y, x + 144, y + 56), radius=28, fill=badge_fill)
    draw.text((x + 35, y + 11), spec["category"], font=font(27, True), fill=(255, 255, 255))
    draw.text((x + 168, y + 8), spec["menu"], font=font(34, True), fill=text_fill)
    price_width = draw.textbbox((0, 0), spec["price"], font=font(34, True))[2]
    draw.text((982 - price_width, y + 8), spec["price"], font=font(34, True), fill=price_fill)


def render_gangnam_card(bg, draw, spec):
    accent = spec["accent"]
    draw.rounded_rectangle((54, 60, 1026, 1290), radius=44, outline=(255, 255, 255, 190), width=3)
    draw.rounded_rectangle((70, 86, 1010, 438), radius=36, fill=(255, 255, 255, 232))
    draw.rectangle((70, 86, 1010, 154), fill=accent)
    draw.text((102, 104), spec["badge"], font=font(30, True), fill=(255, 255, 255))
    draw.text((792, 104), f"PICK {spec['index']:02d}", font=font(30, True), fill=(255, 255, 255))
    draw.text((104, 192), "인간 추천", font=font(34, True), fill=(34, 34, 34))
    draw.text((312, 192), "AI 추천", font=font(34, True), fill=accent)
    draw.text((104, 252), spec["name"], font=font(78, True), fill=(18, 18, 18))
    for i, line in enumerate(wrap_by_width(draw, spec["hook"], font(34, True), 820)[:2]):
        draw.text((108, 350 + i * 42), line, font=font(34, True), fill=(34, 34, 34))
    draw_menu_row(draw, spec, 88, 528, (255, 255, 255), accent, accent)
    draw.line((90, 628, 990, 628), fill=(255, 255, 255, 150), width=2)
    draw_shadow_text(draw, (90, 660), spec["address"], font(29), (255, 255, 255), offset=3)
    draw_footer(draw, accent)


def render_heat_card(bg, draw, spec):
    accent = spec["accent"]
    draw.rectangle((0, 0, 1080, 1350), outline=(255, 80, 80), width=12)
    draw.rounded_rectangle((78, 90, 438, 154), radius=30, fill=(255, 255, 255, 230))
    draw.text((110, 105), spec["badge"], font=font(29, True), fill=accent)
    draw.text((88, 212), "맵기 체크", font=font(52, True), fill=(255, 230, 70), stroke_width=5, stroke_fill=(34, 20, 20))
    for i, line in enumerate(wrap_by_width(draw, spec["name"], font(82, True), 850)[:2]):
        draw.text((88, 300 + i * 96), line, font=font(82, True), fill=(255, 255, 255), stroke_width=6, stroke_fill=(0, 0, 0))
    draw.rounded_rectangle((84, 530, 996, 730), radius=28, fill=(30, 0, 0, 180), outline=(255, 90, 90, 190), width=3)
    for i, line in enumerate(wrap_by_width(draw, spec["hook"], font(34, True), 820)[:2]):
        draw.text((116, 560 + i * 44), line, font=font(34, True), fill=(255, 255, 255))
    draw_menu_row(draw, spec, 116, 652, (255, 255, 255), (255, 230, 70), accent)
    draw.text((90, 768), spec["address"], font=font(29), fill=(255, 235, 235))
    draw_footer(draw, accent)


def render_suwon_card(bg, draw, spec):
    accent = spec["accent"]
    draw.rounded_rectangle((56, 58, 1024, 1292), radius=46, outline=(255, 255, 255, 180), width=3)
    draw.rounded_rectangle((76, 96, 406, 160), radius=30, fill=accent)
    draw.text((108, 111), spec["badge"], font=font(29, True), fill=(255, 255, 255))
    draw.text((90, 214), "수원 통닭거리", font=font(48, True), fill=(255, 236, 76), stroke_width=4, stroke_fill=(36, 20, 0))
    draw.text((90, 282), spec["name"], font=font(92, True), fill=(255, 255, 255), stroke_width=6, stroke_fill=(0, 0, 0))
    draw.rounded_rectangle((80, 828, 1000, 1042), radius=34, fill=(0, 0, 0, 176))
    for i, line in enumerate(wrap_by_width(draw, spec["hook"], font(38, True), 820)[:2]):
        draw.text((112, 858 + i * 48), line, font=font(38, True), fill=(255, 255, 255))
    draw_menu_row(draw, spec, 112, 960, (255, 255, 255), (255, 236, 76), accent)
    draw.text((90, 1078), spec["address"], font=font(28), fill=(255, 245, 225))
    draw_footer(draw, accent)


def render_jeonju_card(bg, draw, spec):
    accent = spec["accent"]
    paper = (255, 248, 226, 232)
    draw.rounded_rectangle((62, 70, 1018, 1284), radius=48, outline=(255, 248, 226, 210), width=3)
    draw.rounded_rectangle((78, 96, 1002, 590), radius=36, fill=paper)
    draw.rounded_rectangle((108, 124, 420, 184), radius=28, fill=accent)
    draw.text((140, 137), spec["badge"], font=font(28, True), fill=(255, 255, 255))
    draw.text((108, 226), "전주 한 상", font=font(44, True), fill=(108, 54, 34))
    draw.text((108, 286), spec["name"], font=font(88, True), fill=(32, 24, 18))
    for i, line in enumerate(wrap_by_width(draw, spec["hook"], font(34, True), 800)[:2]):
        draw.text((112, 402 + i * 44), line, font=font(34, True), fill=(76, 54, 38))
    draw_menu_row(draw, spec, 108, 506, (40, 28, 22), accent, accent)
    draw.rounded_rectangle((76, 1028, 1004, 1138), radius=30, fill=(255, 248, 226, 212))
    draw.text((112, 1058), spec["address"], font=font(29, True), fill=(60, 42, 32))
    draw_footer(draw, accent)


def render_card(spec: dict) -> Image.Image:
    width, height = 1080, 1350
    bg = cover(Image.open(GENERATED_DIR / spec["bg"]).convert("RGBA"), width, height)
    bg = Image.alpha_composite(bg, vertical_gradient(width, height))
    draw = ImageDraw.Draw(bg)

    folder = spec["folder"]
    if "강남" in folder:
        render_gangnam_card(bg, draw, spec)
    elif "영등포" in folder:
        render_heat_card(bg, draw, spec)
    elif "수원" in folder:
        render_suwon_card(bg, draw, spec)
    else:
        render_jeonju_card(bg, draw, spec)
    return bg.convert("RGB")


def main() -> None:
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    for spec in RESTAURANT_CARDS:
        card = render_card(spec)
        episode_dir = CARD_DATA_DIR / spec["folder"]
        episode_dir.mkdir(parents=True, exist_ok=True)
        card.save(episode_dir / f"{spec['index']}.png", format="PNG", optimize=True)
        card.save(PUBLIC_DIR / f"{spec['slug']}.png", format="PNG", optimize=True)
        card.save(PUBLIC_DIR / f"{spec['slug']}.webp", format="WEBP", quality=92, method=6)
        print(PUBLIC_DIR / f"{spec['slug']}.webp")


if __name__ == "__main__":
    main()
