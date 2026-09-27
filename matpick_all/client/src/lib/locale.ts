export type AppLocale = "ko" | "en";

const cuisineTranslations: Record<string, string> = {
  한식: "Korean",
  중식: "Chinese",
  일식: "Japanese",
  양식: "Western",
  멕시칸: "Mexican",
  인도: "Indian",
  태국: "Thai",
  베트남: "Vietnamese",
  미분류: "Unclassified",
  "카페·디저트": "Cafe & dessert",
  음식점: "Restaurant",
  "육류,고기요리": "Meat & barbecue",
  "한식 > 육류,고기요리": "Korean meat & barbecue",
  해산물: "Seafood",
  분식: "Korean snacks",
  술집: "Bar & pub",
  베이커리: "Bakery",
  중식당: "Chinese restaurant",
  "해물,생선요리": "Seafood",
  국수: "Noodles",
  "칼국수,만두": "Knife-cut noodles & dumplings",
  냉면: "Cold noodles",
  돼지고기구이: "Grilled pork",
  "찌개,전골": "Stew & hot pot",
  생선회: "Sashimi",
  국밥: "Soup with rice",
  "치킨,닭강정": "Chicken",
  "육류,고기": "Meat & barbecue",
  종합분식: "Korean snacks",
  떡볶이: "Tteokbokki",
  중국요리: "Chinese",
  닭요리: "Chicken",
  만두: "Dumplings",
  순대: "Korean blood sausage",
  "카페,디저트": "Cafe & dessert",
  "곰탕,설렁탕": "Beef soups",
  컨템퍼러리: "Contemporary",
  "족발,보쌈": "Pork trotters & boiled pork wraps",
  소고기구이: "Grilled beef",
  "곱창,막창,양": "Intestines & tripe",
  해장국: "Hangover soup",
  돈가스: "Pork cutlet",
  베트남음식: "Vietnamese",
  "순대,순댓국": "Korean blood sausage & soup",
  설렁탕: "Ox bone soup",
  칼국수: "Knife-cut noodles",
  감자탕: "Pork back-bone stew",
  한정식: "Korean set menu",
  "초밥,롤": "Sushi & rolls",
  프렌치: "French",
  돼지국밥: "Pork soup with rice",
  피자: "Pizza",
  백반: "Korean set meal",
  평양냉면: "Pyongyang cold noodles",
  닭볶음탕: "Spicy braised chicken",
  막국수: "Buckwheat noodles",
  김밥: "Gimbap",
  바비큐: "Barbecue",
};

const INITIAL_ROMANIZATION = [
  "g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h",
] as const;
const VOWEL_ROMANIZATION = [
  "a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i",
] as const;
const FINAL_ROMANIZATION = [
  "", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "h",
] as const;

const ENGLISH_PLACE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/서울특별시|서울시|서울/g, "Seoul"],
  [/부산광역시|부산시|부산/g, "Busan"],
  [/대구광역시|대구시|대구/g, "Daegu"],
  [/인천광역시|인천시|인천/g, "Incheon"],
  [/광주광역시|광주시|광주/g, "Gwangju"],
  [/대전광역시|대전시|대전/g, "Daejeon"],
  [/울산광역시|울산시|울산/g, "Ulsan"],
  [/세종특별자치시|세종시|세종/g, "Sejong"],
  [/제주특별자치도|제주도|제주/g, "Jeju"],
  [/경기도/g, "Gyeonggi-do"],
  [/강원특별자치도|강원도/g, "Gangwon-do"],
  [/충청북도/g, "Chungcheongbuk-do"],
  [/충청남도/g, "Chungcheongnam-do"],
  [/전북특별자치도|전라북도/g, "Jeonbuk-do"],
  [/전라남도/g, "Jeollanam-do"],
  [/경상북도/g, "Gyeongsangbuk-do"],
  [/경상남도/g, "Gyeongsangnam-do"],
];

const FOOD_TRANSLATIONS: Array<[RegExp, string]> = [
  [/한우\s*안심/g, "Korean beef tenderloin"],
  [/아구찜|아귀찜/g, "braised monkfish"],
  [/밀면/g, "wheat noodles"],
  [/맛집/g, "restaurants"],
  [/양장피/g, "seafood and vegetables with mustard sauce"],
  [/잡탕밥/g, "assorted toppings over rice"],
  [/전복죽/g, "abalone porridge"],
  [/팔보채/g, "stir-fried mixed seafood and vegetables"],
  [/새우튀김/g, "shrimp tempura"],
  [/유산슬밥/g, "yusanseul with rice"],
  [/유산슬/g, "yusanseul stir-fry"],
  [/깐풍새우/g, "kkanpung shrimp"],
  [/깐풍기/g, "kkanpunggi spicy garlic chicken"],
  [/마파두부밥/g, "mapo tofu with rice"],
  [/마파두부/g, "mapo tofu"],
  [/고추잡채/g, "stir-fried peppers and meat"],
  [/골뱅이무침/g, "spicy sea-snail salad"],
  [/고기국수/g, "meat noodle soup"],
  [/생선구이/g, "grilled fish"],
  [/갈치구이/g, "grilled hairtail"],
  [/옥돔구이/g, "grilled tilefish"],
  [/내장탕/g, "offal soup"],
  [/오뎅탕|어묵탕/g, "fish cake soup"],
  [/장어탕/g, "eel soup"],
  [/매운탕/g, "spicy fish stew"],
  [/알탕/g, "fish roe stew"],
  [/산낙지/g, "live octopus"],
  [/닭똥집/g, "chicken gizzards"],
  [/머리고기/g, "boiled head-meat slices"],
  [/녹두전/g, "mung bean pancake"],
  [/부추전/g, "chive pancake"],
  [/굴전/g, "oyster pancake"],
  [/육전/g, "pan-fried meat slices"],
  [/에스프레소/g, "espresso"],
  [/카푸치노/g, "cappuccino"],
  [/얼그레이/g, "Earl Grey tea"],
  [/울면/g, "thick noodle soup"],
  [/라조기/g, "chicken in chili sauce"],
  [/편육/g, "sliced pressed meat"],
  [/잡채/g, "stir-fried glass noodles"],
  [/해삼/g, "sea cucumber"],
  [/멍게/g, "sea squirt"],
  [/백반/g, "Korean set meal"],
  [/오뎅|어묵/g, "fish cake"],
  [/2인이상/g, "for two or more people"],
  [/생선까스/g, "fish cutlet"],
  [/고등어구이/g, "grilled mackerel"],
  [/녹두빈대떡/g, "mung bean pancake"],
  [/두부김치/g, "tofu with stir-fried kimchi"],
  [/열무국수/g, "young-radish noodles"],
  [/황태구이/g, "grilled dried pollock"],
  [/김치전/g, "kimchi pancake"],
  [/동태찌개/g, "pollock stew"],
  [/떡갈비/g, "grilled short-rib patties"],
  [/항정살/g, "jowl cut"],
  [/차돌박이/g, "beef brisket"],
  [/목살/g, "neck cut"],
  [/추어탕/g, "loach soup"],
  [/대구탕/g, "cod soup"],
  [/빈대떡/g, "mung bean pancake"],
  [/순두부/g, "soft tofu"],
  [/온면/g, "warm noodles"],
  [/짜장/g, "black bean sauce"],
  [/쫄면/g, "spicy chewy noodles"],
  [/막걸리/g, "makgeolli rice wine"],
  [/사이다/g, "lemon-lime soda"],
  [/음료/g, "drink"],
  [/나시고랭/g, "nasi goreng"],
  [/폐업/g, "closed"],
  [/꼬리곰탕/g, "oxtail soup"],
  [/도가니수육/g, "boiled ox knee slices"],
  [/도가니탕/g, "ox knee soup"],
  [/비빔국수/g, "spicy mixed noodles"],
  [/잔치국수/g, "banquet noodles"],
  [/콩국수/g, "noodles in cold soy milk"],
  [/계란찜/g, "steamed eggs"],
  [/계란말이/g, "rolled omelet"],
  [/낙지볶음/g, "stir-fried octopus"],
  [/오징어볶음/g, "stir-fried squid"],
  [/갈치조림/g, "braised hairtail"],
  [/닭도리탕|닭볶음탕/g, "spicy braised chicken"],
  [/감자전/g, "potato pancake"],
  [/메밀전병/g, "buckwheat rolls"],
  [/모듬전|모둠전/g, "assorted savory pancakes"],
  [/도토리묵/g, "acorn jelly"],
  [/공기밥/g, "bowl of rice"],
  [/볶음밥/g, "fried rice"],
  [/떡국/g, "rice cake soup"],
  [/육개장/g, "spicy beef soup"],
  [/해장국/g, "hangover soup"],
  [/청국장/g, "fermented soybean stew"],
  [/간짜장/g, "dry-style black bean noodles"],
  [/잡채밥/g, "japchae with rice"],
  [/짜장밥/g, "black bean sauce with rice"],
  [/돼지갈비/g, "pork ribs"],
  [/육회/g, "Korean-style raw meat"],
  [/수육/g, "boiled meat slices"],
  [/곰탕/g, "gomtang soup"],
  [/수제비/g, "hand-torn noodle soup"],
  [/순대/g, "Korean blood sausage"],
  [/술국/g, "hearty sausage soup"],
  [/누룽지/g, "scorched rice"],
  [/사리/g, "extra noodles"],
  [/소주/g, "soju"],
  [/청하/g, "Cheongha rice wine"],
  [/맥주/g, "beer"],
  [/음료수/g, "soft drink"],
  [/돼지국밥/g, "pork soup with rice"],
  [/소고기국밥/g, "beef soup with rice"],
  [/국밥/g, "soup with rice"],
  [/김치찌개/g, "kimchi stew"],
  [/된장찌개/g, "soybean paste stew"],
  [/순두부찌개/g, "soft tofu stew"],
  [/부대찌개/g, "army-base stew"],
  [/삼겹살/g, "pork belly"],
  [/불고기/g, "bulgogi"],
  [/비빔밥/g, "bibimbap"],
  [/냉면/g, "cold noodles"],
  [/칼국수/g, "knife-cut noodles"],
  [/막국수/g, "buckwheat noodles"],
  [/라멘/g, "ramen"],
  [/라면/g, "ramyeon"],
  [/우동/g, "udon"],
  [/짜장면/g, "black bean noodles"],
  [/짬뽕/g, "spicy seafood noodle soup"],
  [/떡볶이/g, "tteokbokki"],
  [/김밥/g, "gimbap"],
  [/만두/g, "dumplings"],
  [/닭갈비/g, "spicy stir-fried chicken"],
  [/갈비탕/g, "short rib soup"],
  [/설렁탕/g, "ox bone soup"],
  [/감자탕/g, "pork back-bone stew"],
  [/삼계탕/g, "ginseng chicken soup"],
  [/보쌈/g, "boiled pork wraps"],
  [/족발/g, "braised pork trotters"],
  [/닭발/g, "chicken feet"],
  [/곱창/g, "small intestines"],
  [/대창/g, "large intestines"],
  [/막창/g, "intestines"],
  [/제육볶음/g, "spicy stir-fried pork"],
  [/돈가스|돈까스/g, "pork cutlet"],
  [/초밥/g, "sushi"],
  [/회덮밥/g, "sashimi rice bowl"],
  [/물회/g, "spicy raw seafood soup"],
  [/파전/g, "green onion pancake"],
  [/해물전/g, "seafood pancake"],
  [/닭강정/g, "sweet crispy chicken"],
  [/치킨/g, "chicken"],
  [/커피/g, "coffee"],
  [/아메리카노/g, "Americano"],
  [/카페라떼|라떼/g, "cafe latte"],
  [/1인분/g, "one serving"],
  [/2인분/g, "two servings"],
  [/시가/g, "market price"],
  [/가격변동|변동/g, "price varies"],
];

const DISCOVERY_TITLE_TRANSLATIONS: Record<string, string> = {
  "부산 한입": "A Bite of Busan",
  "제주 한입": "A Bite of Jeju",
  "여행길 한입": "A Bite on the Road",
  "또간집": "Ttoganjip",
  "인기맛집": "Popular Restaurants",
  "맛있는 녀석들": "Tasty Guys",
  "미쉐린": "Michelin Guide",
  "한국인이 사랑하는 오래된 한식당 100선": "100 Historic Korean Restaurants",
  "식객 허영만의 백반기행": "Heo Young-man’s Hometown Food Travel",
  "수요미식회": "Wednesday Food Talk",
  "백종원의 3대천왕": "Baek Jong-won’s Top 3 Chef Kings",
};

const ORDERED_FOOD_TRANSLATIONS = [...FOOD_TRANSLATIONS].sort(
  ([left], [right]) => right.source.length - left.source.length
);

function romanizeHangulSyllables(value: string) {
  return value.replace(/[가-힣]+/g, word => {
    const romanized = Array.from(word, syllable => {
      const code = syllable.charCodeAt(0) - 0xac00;
      const initial = Math.floor(code / 588);
      const vowel = Math.floor((code % 588) / 28);
      const final = code % 28;
      return `${INITIAL_ROMANIZATION[initial]}${VOWEL_ROMANIZATION[vowel]}${FINAL_ROMANIZATION[final]}`;
    }).join("");
    return romanized.charAt(0).toUpperCase() + romanized.slice(1);
  });
}

export function hasKoreanText(value: string) {
  return /[가-힣]/.test(value);
}

export function romanizeKoreanText(value: string) {
  return romanizeHangulSyllables(value).replace(/\s+/g, " ").trim();
}

export function getEnglishRestaurantName(value: string) {
  return hasKoreanText(value) ? romanizeKoreanText(value) : value;
}

export function getEnglishAddress(value: string) {
  let prepared = value;
  for (const [pattern, replacement] of ENGLISH_PLACE_REPLACEMENTS) {
    prepared = prepared.replace(pattern, `${replacement} `);
  }
  return romanizeKoreanText(prepared).replace(/\s+,/g, ",").replace(/\s+/g, " ").trim();
}

export function getEnglishMenuName(value: string) {
  let prepared = value;
  // Specific dish names must run before generic substrings such as 짜장 or
  // 순두부, otherwise a partial replacement prevents the exact translation.
  for (const [pattern, replacement] of ORDERED_FOOD_TRANSLATIONS) {
    prepared = prepared.replace(pattern, replacement);
  }
  prepared = prepared
    .replace(/\(\s*대\s*\)/g, " (large)")
    .replace(/\(\s*중\s*\)/g, " (medium)")
    .replace(/\(\s*소\s*\)/g, " (small)")
    .replace(/(\d+)\s*인분/g, "$1 servings")
    .replace(/(\d+)\s*인/g, "for $1");
  return romanizeKoreanText(prepared).replace(/\s+/g, " ").trim();
}

export function getLocalizedRestaurantName(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishRestaurantName(value) : value;
}

export function getLocalizedAddress(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishAddress(value) : value;
}

export function getLocalizedMenuName(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishMenuName(value) : value;
}

export function getLocalizedPriceText(value: string, locale: AppLocale) {
  if (locale === "ko") return value;
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/시가/.test(trimmed)) return "Market price";
  if (/가격변동|변동/.test(trimmed)) return "Price varies";
  if (/무료/.test(trimmed)) return "Free";
  if (/[\d,]+\s*원/.test(trimmed)) {
    const translated = trimmed
      .replace(
        /([\d,]+)\s*(?:원)?\s*[~～]\s*([\d,]+)\s*원/g,
        "₩$1–₩$2"
      )
      .replace(/([\d,]+)\s*원/g, "₩$1")
      .replace(/\(\s*1인분\s*\)|\/?\s*1인분/g, " per serving")
      .replace(/\(\s*2인분\s*\)|\/?\s*2인분/g, " for two servings")
      .replace(/\(\s*(\d+)인\s*\)|\/?\s*(\d+)인/g, (_, parenthesized, plain) => ` for ${parenthesized || plain} people`)
      .replace(/\(\s*100\s*g\s*\)|\/?\s*100\s*g/i, " per 100 g")
      .replace(/\s*[~～]\s*$/g, "+")
      .replace(/\s+/g, " ")
      .trim();
    return hasKoreanText(translated) ? "See current price" : translated;
  }
  return hasKoreanText(trimmed) ? "See current price" : trimmed;
}

const DAY_TRANSLATIONS: Record<string, string> = {
  월요일: "Monday", 화요일: "Tuesday", 수요일: "Wednesday", 목요일: "Thursday",
  금요일: "Friday", 토요일: "Saturday", 일요일: "Sunday", 매일: "Daily",
};

export function getLocalizedDayLabel(value: string, locale: AppLocale) {
  return locale === "en" ? DAY_TRANSLATIONS[value.trim()] ?? romanizeKoreanText(value) : value;
}

export function getLocalizedHoursText(value: string, locale: AppLocale) {
  if (locale === "ko") return value;
  const translated = value
    .replace(/정기휴무|휴무일?|휴점/g, "Closed")
    .replace(/브레이크\s*타임/g, "Break")
    .replace(/라스트\s*오더/g, "Last order")
    .replace(/영업시간\s*정보\s*없음/g, "Hours unavailable");
  return hasKoreanText(translated) ? "Check current hours" : translated;
}

export function getLocalizedDiscoveryTitle(value: string, locale: AppLocale) {
  if (locale === "ko") return value;
  return DISCOVERY_TITLE_TRANSLATIONS[value] ?? romanizeKoreanText(value);
}

export function getLocalizedEditorialSummary(
  value: string | null | undefined,
  locale: AppLocale,
  englishFallback: string
) {
  if (locale === "ko") return value ?? "";
  if (!value) return englishFallback;
  if (!hasKoreanText(value)) return value;
  return englishFallback;
}

export function getBrowserFallbackLocale(): AppLocale {
  // Canonical pages stay Korean for first-time visitors and search engines.
  // An explicit visitor choice, rather than IP/browser language, enables English.
  try {
    return window.localStorage.getItem("matpick_locale") === "en" ? "en" : "ko";
  } catch {
    return "ko";
  }
}

export function isEnglishLocale(locale: AppLocale) {
  return locale === "en";
}

export function translateCuisineLabel(label: string, locale: AppLocale) {
  if (locale === "ko") {
    return label;
  }

  return cuisineTranslations[label] ?? getEnglishMenuName(label);
}

export function getLocaleMeta(locale: AppLocale) {
  return locale === "en"
    ? {
        htmlLang: "en",
        ogLocale: "en_US",
        alternateOgLocale: "ko_KR",
      }
    : {
        htmlLang: "ko",
        ogLocale: "ko_KR",
        alternateOgLocale: "en_US",
      };
}
