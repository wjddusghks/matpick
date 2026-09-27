import { getEnglishMenuName as translateEnglishMenuName } from "./menuEnglish.ts";

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
  일식당: "Japanese restaurant",
  일식집: "Japanese restaurant",
  해물: "Seafood",
  "해물,생선": "Seafood",
  카페: "Cafe",
  디저트: "Dessert",
  베이커리: "Bakery",
  이탈리아음식: "Italian",
  이탈리안: "Italian",
  이탤리언: "Italian",
  프랑스음식: "French",
  태국음식: "Thai",
  인도음식: "Indian",
  "아시아음식": "Asian",
  아시안: "Asian",
  멕시코음식: "Mexican",
  "멕시코,남미음식": "Mexican & Latin American",
  햄버거: "Burgers",
  이자카야: "Izakaya",
  일본식주점: "Japanese pub",
  호프: "Pub",
  "호프,요리주점": "Pub & dining bar",
  요리주점: "Dining bar",
  와인바: "Wine bar",
  브런치: "Brunch",
  비건: "Vegan",
  베지테리안: "Vegetarian",
  뷰페: "Buffet",
  패밀리레스토랑: "Family restaurant",
  레스토랑: "Restaurant",
  커피전문점: "Coffee shop",
  디저트카페: "Dessert cafe",
  브런치카페: "Brunch cafe",
  "제과,베이커리": "Bakery",
  "제과,제빵": "Bakery",
  패스트푸드: "Fast food",
  포장마차: "Street-food pub",
  실내포장마차: "Indoor street-food pub",
  기업: "Business",
  미용실: "Hair salon",
  사진: "Photography",
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

const ENGLISH_SOURCE_NAMES: Record<string, string> = {
  "한국인이 사랑하는 오래된 한식당 100선": "100 Historic Korean Restaurants",
  "한국인 100선": "100 Historic Korean Restaurants",
  "백종원의 3대천왕": "Baek Jong-won's Top 3 Chef Kings",
  "식객 허영만의 백반기행": "Heo Young-man's Hometown Food Travel",
  "백반기행": "Hometown Food Travel",
  "수요미식회 맛집리스트": "Wednesday Food Talk Restaurant List",
  "수요미식회": "Wednesday Food Talk",
  "또간집": "Ttoganjip",
  "인기맛집": "Popular Restaurants",
  "맛있는 녀석들": "Tasty Guys",
  "미쉐린": "MICHELIN Guide",
  "부산 한입": "A Bite of Busan",
  "제주 한입": "A Bite of Jeju",
  "전현무계획": "Jeon Hyun-moo's Plan",
  "생활의 달인": "Master of Living",
  "토요일은 밥이 좋아": "Saturday Is for Food",
  "동네 한 바퀴": "A Walk Around the Neighborhood",
  "성시경 먹을텐데": "Sung Si-kyung's Eat What?",
  "츄릅켠": "Chureupkyeon",
  "제주에디": "Jeju Eddy",
  "김사원세끼": "Employee Kim's Three Meals",
  "서울미식 100선": "Taste of Seoul 100",
  "백년가게": "Century Stores",
  "착한가격업소": "Good Price Businesses",
  "섬마을훈태": "Island Village Hoon-tae",
  "정육왕": "Meat King",
  "회사랑": "Hoe Sarang",
  "떡볶퀸": "Tteokbokqueen",
  "최자로드": "Choiza Road",
  "2TV 생생정보": "2TV Live Info",
  "생방송 투데이": "Live Today",
  "오늘N": "Today N",
  "더들리": "The Dudley",
  "흑백요리사 출연 셰프 식당": "Culinary Class Wars Chef Restaurants",
};

const ENGLISH_PROVIDER_NAMES: Record<string, string> = {
  "E채널": "E Channel",
  "성시경": "Sung Si Kyung",
  "츄릅켠": "Chureupkyeon",
  "제주에디": "Jeju Eddy",
  "김사원세끼": "Employee Kim's Three Meals",
  "서울관광재단": "Seoul Tourism Organization",
  "중소벤처기업부": "Ministry of SMEs and Startups",
  "행정안전부·지방자치단체": "Ministry of the Interior and Safety & local governments",
  "섬마을훈태": "Island Village Hoon-tae",
  "정육왕": "Meat King",
  "회사랑": "Hoe Sarang",
  "떡볶퀸": "Tteokbokqueen",
  "최자로드": "Choiza Road",
  "더들리": "The Dudley",
  "맛픽": "Matpick",
};

const ENGLISH_CREATOR_NAMES: Record<string, string> = {
  "풍자": "Pungja",
  "성시경": "Sung Si-kyung",
  "맛있는 녀석들": "Tasty Guys",
  "쥐양": "Tzuyang",
  "스튜디오수제": "Studio Suze",
  "성시경 SUNG SI KYUNG": "Sung Si Kyung",
  "tzuyang쥐양": "Tzuyang",
};

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
    prepared = prepared.replace(pattern, replacement);
  }
  prepared = prepared
    .replace(/\b(Seoul|Busan|Daegu|Incheon|Gwangju|Daejeon|Ulsan|Sejong|Jeju)\s+/g, "$1, ")
    .replace(/\b(Gyeonggi-do|Gangwon-do|Chungcheongbuk-do|Chungcheongnam-do|Jeonbuk-do|Jeollanam-do|Gyeongsangbuk-do|Gyeongsangnam-do)\s+/g, "$1, ")
    .replace(/\uC9C0\uD558\s*(\d+)\s*\uCE35/g, "Basement level $1")
    .replace(/(\d+)\s*\uCE35/g, "Floor $1")
    .replace(/([A-Za-z]?-?\d+[A-Za-z-]*)\s*\uD638/g, "Unit $1")
    .replace(/(\d+(?:-\d+)?)\s*\uBC88\uC9C0/g, "$1")
    .replace(/([\uAC00-\uD7A3]+?)(\d*)\uB300\uB85C(?=\s|,|$)/g, (_, root, number) => `${romanizeHangulSyllables(root)}${number ? ` ${number}` : ""}-daero`)
    .replace(/([\uAC00-\uD7A3]+?)(\d*)\uB85C(?=\s|,|$)/g, (_, root, number) => `${romanizeHangulSyllables(root)}${number ? ` ${number}` : ""}-ro`)
    .replace(/([\uAC00-\uD7A3]+?)(\d*)\uAE38(?=\s|,|$)/g, (_, root, number) => `${romanizeHangulSyllables(root)}${number ? ` ${number}` : ""}-gil`)
    .replace(/(\d+)\s*\uAE38(?=\s|,|$)/g, "$1-gil")
    .replace(/([\uAC00-\uD7A3]+)\uD2B9\uBCC4\uC790\uCE58\uC2DC(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-si`)
    .replace(/([\uAC00-\uD7A3]+)\uC2DC(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-si`)
    .replace(/([\uAC00-\uD7A3]+)\uAD6C(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-gu`)
    .replace(/([\uAC00-\uD7A3]+)\uAD70(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-gun`)
    .replace(/([\uAC00-\uD7A3]+)\uC74D(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-eup`)
    .replace(/([\uAC00-\uD7A3]+)\uBA74(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-myeon`)
    .replace(/([\uAC00-\uD7A3]+)\uB3D9(\d*)\uAC00(?=\s|,|$)/g, (_, root, number) => `${romanizeHangulSyllables(root)}-dong ${number}-ga`)
    .replace(/([\uAC00-\uD7A3]+)\uB3D9(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-dong`)
    .replace(/([\uAC00-\uD7A3]+)\uB9AC(?=\s|,|$)/g, (_, root) => `${romanizeHangulSyllables(root)}-ri`)
    .replace(/([\uAC00-\uD7A3]+)\uBE4C\uB529/g, (_, root) => `${romanizeHangulSyllables(root)} Building`)
    .replace(/([\uAC00-\uD7A3]+)\uD0C0\uC6CC/g, (_, root) => `${romanizeHangulSyllables(root)} Tower`)
    .replace(/([\uAC00-\uD7A3]+)\uC0C1\uAC00/g, (_, root) => `${romanizeHangulSyllables(root)} Shopping Arcade`)
    .replace(/\uC0C1\uAC00(?=\s|,|$)/g, "Shopping Arcade")
    .replace(/\uCF54\uC5D1\uC2A4/g, "COEX");
  return romanizeKoreanText(prepared)
    .replace(/\b([A-Z][A-Za-z]+-(?:si|gu|gun|eup|myeon|dong|ri))\s+/g, "$1, ")
    .replace(/\s+,/g, ",")
    .replace(/,\s*,+/g, ",")
    .replace(/\s+/g, " ")
    .trim();
}

export function getEnglishSourceName(value: string) {
  const trimmed = value.trim();
  return ENGLISH_SOURCE_NAMES[trimmed] ?? romanizeKoreanText(trimmed);
}

export function getLocalizedSourceName(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishSourceName(value) : value;
}

export function getEnglishProviderName(value: string) {
  const trimmed = value.trim();
  return ENGLISH_PROVIDER_NAMES[trimmed] ?? romanizeKoreanText(trimmed);
}

export function getLocalizedProviderName(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishProviderName(value) : value;
}

export function getEnglishCreatorName(value: string) {
  const trimmed = value.trim();
  return ENGLISH_CREATOR_NAMES[trimmed] ?? getEnglishSourceName(trimmed);
}

export function getLocalizedCreatorName(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishCreatorName(value) : value;
}

export function getEnglishEpisodeLabel(value: string) {
  const translated = value
    .replace(/\uC81C\s*(\d+)\s*\uD68C/g, "Episode $1")
    .replace(/(\d+)\s*\uD68C/g, "Episode $1")
    .replace(/(\d+)\s*\uBD80/g, "Part $1")
    .replace(/\uC2DC\uC98C\s*(\d+)/g, "Season $1")
    .replace(/(\d{4})\s*\uB144\s*(\d{1,2})\s*\uC6D4\s*(\d{1,2})\s*\uC77C/g, "$1-$2-$3")
    .replace(/(\d{1,2})\s*\uC6D4\s*(\d{1,2})\s*\uC77C/g, "$1/$2");
  return romanizeKoreanText(translated);
}

export function getLocalizedEpisodeLabel(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishEpisodeLabel(value) : value;
}

export function getLocalizedRegion(value: string, locale: AppLocale) {
  return locale === "en" ? getEnglishAddress(value) : value;
}

export function getLocalizedSearchLabel(value: string | null | undefined, locale: AppLocale) {
  if (!value || locale === "ko") return value ?? "";
  const labels: Record<string, string> = {
    "\uC774\uB984": "Name",
    "\uC2DD\uB2F9\uBA85": "Restaurant",
    "\uC8FC\uC18C": "Address",
    "\uC9C0\uC5ED": "Region",
    "\uBA54\uB274": "Menu",
    "\uB300\uD45C\uBA54\uB274": "Signature menu",
    "\uCE74\uD14C\uACE0\uB9AC": "Cuisine",
    "\uCD9C\uCC98": "Source",
    "\uBC29\uC1A1": "TV show",
    "\uBC29\uC1A1\u00B7\uAC00\uC774\uB4DC": "Show or guide",
    "\uD06C\uB9AC\uC5D0\uC774\uD130": "Creator",
    "\uD1B5\uD569 \uAC80\uC0C9": "All matches",
    "\uBA54\uB274 \uC77C\uCE58": "Menu match",
    "\uC9C0\uC5ED \uC77C\uCE58": "Region match",
    "\uCE74\uD14C\uACE0\uB9AC \uC77C\uCE58": "Cuisine match",
    "\uBC29\uC1A1\u00B7\uCD9C\uCC98 \uC77C\uCE58": "Show or source match",
    "\uC2DD\uB2F9\uBA85 \uC77C\uCE58": "Name match",
    "\uAC00\uC774\uB4DC": "Guide",
    "\uBBF8\uC250\uB9B0": "MICHELIN Guide",
    "\uAE30\uAD00 \uC120\uC815": "Institution selection",
    "\uCC45": "Book",
    "\uB9E4\uAC70\uC9C4": "Magazine",
  };
  return labels[value.trim()] ?? romanizeKoreanText(value);
}

export function getLocalizedSearchDetail(
  value: string | null | undefined,
  matchLabel: string | null | undefined,
  locale: AppLocale
) {
  if (!value || locale === "ko") return value ?? "";
  const trimmed = value.trim();
  if (matchLabel === "\uBA54\uB274 \uC77C\uCE58") {
    return trimmed.split(/\s*\u00B7\s*/).map(getEnglishMenuName).join(" · ");
  }
  if (matchLabel === "\uCE74\uD14C\uACE0\uB9AC \uC77C\uCE58") {
    return translateCuisineLabel(trimmed, locale);
  }
  if (matchLabel === "\uC9C0\uC5ED \uC77C\uCE58" || /[\uAC00-\uD7A3]+(?:\uB85C|\uAE38|\uAD6C|\uC2DC|\uB3D9|\uC74D|\uBA74)(?:\s|\d|$)/.test(trimmed)) {
    return getEnglishAddress(trimmed);
  }
  const aggregate = trimmed.match(/^\uBA54\uB274\u00B7\uCE74\uD14C\uACE0\uB9AC\u00B7\uC9C0\uC5ED\uC5D0\uC11C\s*([\d,]+)\uACF3$/);
  if (aggregate) return `${aggregate[1]} restaurants across menus, cuisines, and regions`;
  const count = trimmed.match(/^(?:\uB9DB\uC9D1|\uC2DD\uB2F9)\s*([\d,]+)(?:\uAC1C|\uACF3)$/);
  if (count) return `${count[1]} restaurants`;
  return getLocalizedSearchLabel(trimmed, locale);
}

export function getLocalizedSubscriberCount(value: string, locale: AppLocale) {
  if (locale === "ko") return value;
  const match = value.trim().match(/^([\d,.]+)\s*\uB9CC$/);
  if (!match) return romanizeKoreanText(value);
  const amount = Number(match[1].replace(/,/g, "")) / 100;
  return `${Number.isInteger(amount) ? amount : amount.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}M`;
}

export function getEnglishMenuName(value: string) {
  return translateEnglishMenuName(value);
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
  return ENGLISH_SOURCE_NAMES[value] ?? DISCOVERY_TITLE_TRANSLATIONS[value] ?? getEnglishSourceName(value);
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
