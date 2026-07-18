import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");
const verifiedAt = "2026-07-18";

const culinaryPath = path.join(root, "source-data", "culinary-class-wars", "restaurants.json");
const seasonPath = (season) => path.join(root, "source-data", "jeonhyunmoo-plan", `season-${season}`, "restaurants.json");

function menu(name, price, sourceId, isSignature = false) {
  return {
    name,
    price: price == null ? null : `${Number(price).toLocaleString("ko-KR")}원`,
    isSignature,
    sourceId,
    observedAt: verifiedAt,
    confidence: 0.9,
  };
}

function foreignMenu(name, price, sourceId, isSignature = false, observedAt = verifiedAt) {
  return {
    name,
    price: price || null,
    isSignature,
    sourceId,
    observedAt,
    confidence: 0.9,
  };
}

function replaceById(records, id, patch) {
  const index = records.findIndex((record) => record.id === id);
  if (index < 0) throw new Error(`Record not found: ${id}`);
  records[index] = { ...records[index], ...patch };
}

function appendUniqueNote(existingNotes, note) {
  return [...new Set([
    ...String(existingNotes ?? "").split(" / ").map((item) => item.trim()).filter(Boolean),
    ...(String(note ?? "").trim() ? [String(note).trim()] : []),
  ])].join(" / ");
}

const nonMenuHeadings = new Set([
  "메뉴판",
  "entree",
  "Sea Food",
  "Bread&Gnocchi",
  "Meat",
  "냉채 및 스프",
  "해삼, 상어 지느러미",
  "해산물",
  "소고기 및 돼지고기",
  "닭고기 및 새우",
  "면류",
  "밥류",
]);

function markUnavailablePrices(records, { culinary = false } = {}) {
  for (const record of records) {
    record.notes = appendUniqueNote(record.notes);
    const originalMenus = record.menus ?? [];
    const menus = originalMenus.filter((item) => !nonMenuHeadings.has(item.name));
    let markedCount = 0;

    record.menus = menus.map((item) => {
      if (item.price != null && String(item.price).trim()) return item;

      markedCount += 1;
      let price = "가격 미공개";
      if (record.id === "culinary-class-wars-s1-2-1") {
        price = "$125 5코스 선택 구성";
      } else if (/콜키지 프리|서비스/.test(item.name)) {
        price = "무료";
      } else if (/덕자찜|골뱅이|과메기|홍어애|홍어삼합|생굴회|^낙지$|쏘가리탕\/회/.test(item.name)) {
        price = "시가·현장 문의";
      } else if (/삭힌 홍어 단계별 시식/.test(item.name)) {
        price = "주문 메뉴에 포함";
      }

      return { ...item, price };
    });

    if (originalMenus.length > 0 && menus.length === 0) {
      record.representativeMenu = "";
      record.menuPriceStatus = "public-menu-unavailable";
      record.notes = appendUniqueNote(record.notes, "카테고리 제목을 메뉴로 저장한 항목을 제거했으며 실제 공개 메뉴판은 확인되지 않음");
    }
    if (markedCount > 0) {
      record.menuPriceNote = culinary
        ? "가격 미공개는 현재 공개 출처에서 고정가를 확인하지 못한 메뉴이며, 코스 구성·무료·시가는 별도로 표시함"
        : "가격 미공개는 현재 공개 출처에서 고정가를 확인하지 못한 메뉴이며, 포함 메뉴·시가는 별도로 표시함";
    }
  }
}

function researchedPatch({ name, address, region, phone, menus, sourceLabel, sourceUrl, notes }) {
  const pricedCount = menus.filter((item) => item.price).length;
  return {
    name,
    address,
    region,
    phone,
    menus,
    representativeMenu: menus.slice(0, 4).map((item) => `${item.name}${item.price ? ` ${item.price}` : ""}`).join(", "),
    menuPriceStatus: pricedCount === menus.length
      ? "current-public-full-menu"
      : pricedCount
        ? "current-public-menu-partial-prices"
        : "public-menu-without-prices",
    menuPriceVerifiedAt: verifiedAt,
    menuPriceSources: [{ label: sourceLabel, url: sourceUrl }],
    reviewStatus: "menu-address-reviewed",
    confidence: 0.9,
    notes,
  };
}

function researchedCulinaryKakaoPatch({ restaurantName, address, region, phone, menus, placeId, notes }) {
  const patch = researchedPatch({
    name: restaurantName,
    address,
    region,
    phone,
    menus,
    sourceLabel: "카카오맵 현재 전체 메뉴판",
    sourceUrl: `https://place.map.kakao.com/${placeId}`,
    notes,
  });
  const { name: ignoredName, ...fields } = patch;
  return {
    ...fields,
    restaurantName,
    kakaoPlaceId: String(placeId),
    placeUrl: `https://place.map.kakao.com/${placeId}`,
    matchedPlaceName: restaurantName,
  };
}

const culinary = JSON.parse(await readFile(culinaryPath, "utf8"));
replaceById(culinary, "culinary-class-wars-s1-2-1", {
  menus: [
    foreignMenu("5-course tasting menu", "$125", "official-610-sample-menu", true, "2024-04-01"),
    foreignMenu("610 B.L.T.", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Pea Velouté, Bay Scallop, Horseradish, Buttermilk, Pea Tendrils", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Bluefin Tuna Tataki, Asparagus, Ponzu, Sorrel, Pomelo, Shiso", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Carrot Cavatelli, Carrot, Saag, Paneer, Cashew Dukkah, Garam Masala", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("BBQ Hamachi Collar, Rice Crepe, Papaya, Nuoc Cham, Fried Shallot, Herbs", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Seared Scallop, Peanut Pesto, Edamame Grits, King Oyster Mushrooms, Pickled Peppers", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Venison, Celery Root, Brussels Sprouts, Cipollini Onion, Haskapberry Jus", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Duck Breast, Duck Confit, Congee, Bok Choy, Kohlrabi Kimchi, Quail Egg", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Crème Caramel, Sorghum, Apple, Persimmon, Black Walnut", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Drunken Banana Cake, Butterscotch, Chocolate, Maple Syrup, Corn, Brown Butter Ice Cream", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("Artisan Cheese Plate with Accompaniments", null, "official-610-sample-menu", false, "2024-04-01"),
    foreignMenu("5-course wine pairing", "$65", "official-610-sample-menu", false, "2024-04-01"),
  ],
  representativeMenu: "5-course tasting menu $125, 5-course wine pairing $65",
  menuPriceStatus: "official-sample-menu-variable",
  menuPriceVerifiedAt: verifiedAt,
  menuPriceSources: [{ label: "610 Magnolia 공식 샘플 메뉴", url: "https://610magnolia.com/wp-content/uploads/2024/03/610-Sample-Menu2024.04.pdf" }],
  notes: "공식 안내상 구성과 가격은 매주 달라지므로 샘플 메뉴 전체와 코스 가격을 저장함",
});
replaceById(culinary, "culinary-class-wars-s1-2-2", {
  menus: [
    foreignMenu("Chicken Mandu", "$7", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Shrimp Mandu", "$9", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Vegetable Pajun", "$13", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Fried Tofu Balls", "$8", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Romaine Salad", "$11", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Duck Spring Roll", "$8", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Braised Beef Steam Bun", "$10", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Tiger Skin Egg", "$6", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("So-tteok So-tteok", "$7", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Crab Gyeran-jjim", "$12", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Strawberry Sando", "$6", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Kimchi Fried Rice", "$14", "official-nami-brunch", true, "2025-02-01"),
    foreignMenu("Ja Jang Myun Noodles", "$18", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Bulgogi Benedict", "$19", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Grilled Pork Ribs", "$20", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Steak & Eggs", "$21", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Bacon Bibimbap", "$18", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Korean Milk Bread French Toast", "$16", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Mochi Pancakes", "$15", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Salmon Hand Roll", "$9", "official-nami-brunch", false, "2025-02-01"),
    foreignMenu("Tuna Hand Roll", "$10", "official-nami-brunch", false, "2025-02-01"),
  ],
  representativeMenu: "Kimchi Fried Rice $14, Bulgogi Benedict $19, Steak & Eggs $21",
  menuPriceStatus: "official-brunch-menu-2025",
  menuPriceVerifiedAt: verifiedAt,
  menuPriceSources: [{ label: "Nami 공식 브런치 메뉴", url: "https://nami-restaurant.com/s/Nami-Brunch-Menu-202502.pdf" }],
  notes: "검색 가능한 공식 브런치 메뉴판 전체 항목 반영. 디너 메뉴는 공식 사이트에서 공개 가격 확인 불가",
});
replaceById(culinary, "culinary-class-wars-s1-2-3", {
  menus: [
    foreignMenu("Delta Rice Bowl", "$23.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Pimento Cheese Burger", "$19.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Shrimp 'n' Grits", "$33.00", "official-succotash-supper", true, "2025-05-12"),
    foreignMenu("Crispy Local Blue Catfish", "$25.75", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Apple Cider BBQ Pork Ribs", "$33.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Today's Catch", "$33.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Taste the South (adult)", "$60.00", "official-succotash-supper", true, "2025-05-12"),
    foreignMenu("Taste the South (child 12 and under)", "$30.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Deviled Eggs", "$1.75 each", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Crispy Korean Cauliflower", "$14.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Jamie's Cornbread", "$8.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Kimchi Crab Dip", "$24.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Chicken & Waffles", "$29.00", "official-succotash-supper", true, "2025-05-12"),
    foreignMenu("Dirty Chicken", "$31.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Collards, Kimchi & Smoked Turkey", "$7.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Old Bay Mac 'n' Cheese", "$10.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("French Fries", "$5.25", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Tater Tots, Gochujang Mayo, Furikake", "$7.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Mushroom Dirty Rice", "$7.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Seasonal Side", "$7.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Creamy Corn Succotash", "$9.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Ginger-Chili Caulilini", "$10.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Smoked Chicken Wings", "$14.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Chilled Shrimp Summer Roll", "$18.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Hot-Fried Oysters", "$17.50", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Hamachi Crudo", "$22.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Smoked & Grilled Pork Belly Ssam", "$18.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Fried Green Tomato Salad", "$16.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Seasonal House Salad", "$19.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("New York Strip 16 oz", "$47.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Petit Filet Mignon 8 oz", "$48.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Skirt Steak 12 oz", "$50.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Ribeye 14 oz", "$62.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Filet Mignon 12 oz", "$68.00", "official-succotash-supper", false, "2025-05-12"),
    foreignMenu("Bone-in Tomahawk 42 oz (serves 2)", "$145.00", "official-succotash-supper", false, "2025-05-12"),
  ],
  representativeMenu: "Taste the South $60, Chicken & Waffles $29, Shrimp 'n' Grits $33",
  menuPriceStatus: "official-supper-full-menu-2025",
  menuPriceVerifiedAt: verifiedAt,
  menuPriceSources: [{ label: "Succotash Prime 공식 supper 전체 메뉴", url: "https://www.succotashrestaurant.com/wp-content/uploads/2025/05/Succotash-Prime-Supper-Menu-5.12.25.pdf" }],
  notes: "공식 supper 메뉴판의 전체 음식 항목과 가격 반영. 브런치·런치·음료는 별도 메뉴판",
});
replaceById(culinary, "culinary-class-wars-s1-19-2", {
  restaurantName: "Grand Majestic Sichuan",
  address: "Shop 301, Alexandra House, 18 Chater Road, Central, Hong Kong",
  menus: [
    ...[
      ["Curated Menu For One", 488], ["Smacked Cucumber", 118], ["Hot and Sour Wood Ear Mushrooms", 148],
      ["Bang Bang Chicken", 178], ["Chilled Jellyfish", 198], ["Hot and Sour Soup", 108],
      ["Chilli Oil Pork Wontons", 218], ["Fish Fragrant Prawns", 368], ["Kung Pao Prawns", 388],
      ["Kung Pao Chicken", 338], ["Tangerine Peel Beef", 368], ["Potato and Lotus Root", 188],
      ["Stir Fried Celtuce", 198], ["Stir Fried Broccoli", 168], ["Fish Fragrant Aubergine", 188],
      ["Stir Fried Green Beans", 208], ["Mapo Tofu", 258], ["Preserved Vegetable Fried Rice", 128],
      ["Sichuan Bacon Fried Rice", 188], ["Sichuan Cold Noodles", 198], ["Steamed Jasmine Rice", 38],
      ["Acqua Panna 750ml", 68], ["San Pellegrino 750ml", 68], ["Coke 330ml", 38],
      ["Coke Zero 330ml", 38], ["Sprite 330ml", 38], ["Devaux Cuvee D", 318],
      ["Bodegas Frontonio Microcosmico", 298], ["Telmo Rodriguez GABA", 228],
    ].map(([name, price]) => foreignMenu(name, `HK$ ${price}`, "foodpanda-grand-majestic", name === "Mapo Tofu")),
  ],
  representativeMenu: "Mapo Tofu HK$ 258, Kung Pao Chicken HK$ 338, Chilli Oil Pork Wontons HK$ 218",
  menuPriceStatus: "current-delivery-full-menu",
  menuPriceVerifiedAt: verifiedAt,
  menuPriceSources: [{ label: "Grand Majestic Sichuan 공개 배달 전체 메뉴", url: "https://www.foodpanda.hk/chain/cv4qd/grand-majestic-sichuan" }],
  notes: "공식 식당 주소로 교정하고 현재 공개된 배달 메뉴의 음식·음료 29개 가격 반영",
});
replaceById(culinary, "culinary-class-wars-s1-79-1", {
  menus: [
    foreignMenu("Original Chicken", "$12.90+", "delivery-101-chicken", true),
    foreignMenu("Original Hot Pepper Chicken", "$13.50+", "delivery-101-chicken"),
    foreignMenu("101 Potato Crisp Chicken", "$14.90+", "delivery-101-chicken", true),
    foreignMenu("Sweet & Spicy Chicken", "$13.50+", "delivery-101-chicken"),
    foreignMenu("Hot & Spicy Chicken", "$13.50+", "delivery-101-chicken"),
    foreignMenu("Soy Honey Chicken", "$13.50+", "delivery-101-chicken"),
    foreignMenu("Spicy Soy Honey Garlic Chicken", "$13.90+", "delivery-101-chicken"),
    foreignMenu("Chicken & Croffles", "$14.90+", "delivery-101-chicken"),
    foreignMenu("Supreme Chicken", null, "official-101-menu"),
    foreignMenu("Garlic Crumble Chicken", "$13.90+", "delivery-101-chicken"),
    foreignMenu("Chi-Rimp", null, "official-101-menu"),
    foreignMenu("101 Potato Crisp Chicken Sandwich", "$8.50", "delivery-101-chicken"),
    foreignMenu("101 Spicy Potato Crisp Chicken Sandwich", "$9.00", "delivery-101-chicken"),
    foreignMenu("Jambon Chicken Sandwich", null, "official-101-menu"),
    foreignMenu("Original Chicken & Rice", null, "official-101-menu"),
    foreignMenu("Spicy Chicken & Rice", null, "official-101-menu"),
    foreignMenu("101 Ddukbokki", "$13.00", "delivery-101-chicken"),
    foreignMenu("Rose Ddukbokki", null, "official-101-menu"),
    foreignMenu("Cheese Balls", "$7.00", "delivery-101-chicken"),
    foreignMenu("French Fries", "$6.00+", "delivery-101-chicken"),
    foreignMenu("Corn Coleslaw", "$4.00", "delivery-101-chicken"),
    foreignMenu("Garlic Rice", "$3.00", "delivery-101-chicken"),
    foreignMenu("Radish Pickle", null, "official-101-menu"),
    foreignMenu("A Combo", null, "official-101-menu"),
    foreignMenu("B Combo", null, "official-101-menu"),
    foreignMenu("Canned Soda", "$2.00", "delivery-101-chicken"),
  ],
  representativeMenu: "Original Chicken $12.90+, 101 Potato Crisp $14.90+, Sweet & Spicy $13.50+",
  menuPriceStatus: "current-public-menu-partial-prices",
  menuPriceVerifiedAt: verifiedAt,
  menuPriceSources: [
    { label: "101 Chicken 공식 전체 메뉴", url: "https://www.101chicken.com/menu" },
    { label: "Fort Lee 현재 주문 가격", url: "https://www.grubhub.com/restaurant/101-chicken---fort-lee-store-2151-lemoine-ave-fort-lee/8077304" },
  ],
  notes: "공식 메뉴의 전체 음식 항목을 저장하고 현재 공개 주문 가격을 가능한 항목에 결합함",
});
replaceById(culinary, "culinary-class-wars-s1-5-5", researchedCulinaryKakaoPatch({
  restaurantName: "네기실비 신사점",
  address: "서울 강남구 논현로151길 55 호경빌딩 1층",
  region: "서울 강남구",
  phone: "02-515-1879",
  placeId: "1386181341",
  menus: [
    ...[
      ["모둠회3종", 95000], ["산낙지차돌돌판구이", 45000], ["전어회무침", 28000], ["민어매운탕", 38000],
      ["민어전(6kg급)", 32000], ["통영찰도미막회(중)", 48000], ["통영찰도미막회(대)", 68000],
      ["울진모둠해물숙회한상", 58000], ["제주백옥돔튀김", 35000], ["활가리비직화구이", 28000],
      ["도미머리소금구이", 24000], ["구룡포홍게매운탕라면", 24000], ["직화돼지갈비", 23000],
      ["수제고추튀김", 15000], ["디저트로즐기는꿀땅콩과쥐포튀김", 12000], ["엄마손유부초밥", 10000],
      ["마산식아귀수육", 72000], ["진주식찰도미막회(중)", 48000], ["진주식찰도미막회(대)", 68000],
      ["울진식모듬해물숙회한상", 65000], ["생대구지리", 45000], ["생대구전", 32000],
      ["골뱅이조개어묵탕", 35000], ["통영굴전", 26000], ["우삼겹즉석떡볶이", 28000],
      ["왕오징어튀김", 25000], ["방어머리소금구이", 24000], ["제주카마스소금구이", 24000],
      ["새우매운탕라면", 25000], ["경상도식줄쥐포튀김", 14000],
    ].map(([name, price], index) => menu(name, price, "kakao-place-menu", index === 0)),
  ],
  notes: "폐점한 광화문점 대신 현재 영업 중인 동일 브랜드 신사점을 연결하고 공개 메뉴판 30개 전체 반영",
}));
replaceById(culinary, "culinary-class-wars-s1-10-1", researchedCulinaryKakaoPatch({
  restaurantName: "로컬릿피자",
  address: "강원 강릉시 초당원길 32-2",
  region: "강원 강릉시",
  phone: "",
  placeId: "2087840899",
  menus: [
    menu("트러플감자뇨끼", 18000, "kakao-place-menu", true), menu("치킨밀라네제", 18000, "kakao-place-menu"),
    menu("새우구이", 16000, "kakao-place-menu"), menu("올리브튀김", 9000, "kakao-place-menu"),
    menu("고구마튀김", 8000, "kakao-place-menu"), menu("살시차후무스", 9000, "kakao-place-menu"),
    menu("리코타루꼴라샐러드", 7000, "kakao-place-menu"), menu("단새우튀김", 20000, "kakao-place-menu"),
  ],
  notes: "서울 로컬릿 폐점 후 현재 운영되는 로컬릿피자로 연결하고 공개 메뉴판 8개 전체 반영",
}));
replaceById(culinary, "culinary-class-wars-s1-42-2", researchedCulinaryKakaoPatch({
  restaurantName: "오초 오늘의초밥 이천점",
  address: "경기 이천시 마장면 중앙로9번길 7 1층 102호",
  region: "경기 이천시",
  phone: "031-636-7078",
  placeId: "771909281",
  menus: [
    menu("카이센동", 19000, "kakao-place-menu", true), menu("오늘의초밥", 17000, "kakao-place-menu"),
    menu("후토마끼", 27000, "kakao-place-menu"), menu("특초밥", 29000, "kakao-place-menu"),
  ],
  notes: "폐점한 광교점 대신 현재 확인 가능한 동일 브랜드 이천점을 연결하고 공개 메뉴판 전체 반영",
}));
replaceById(culinary, "culinary-class-wars-s1-44-1", {
  ...researchedCulinaryKakaoPatch({
    restaurantName: "넘은봄 제주음식연구소",
    address: "제주 제주시 거로남8길 21-32 106동 1층 104호",
    region: "제주 제주시",
    phone: "0507-1340-1189",
    placeId: "1863530579",
    menus: [menu("제주 9코스", 90000, "kakao-place-menu", true)],
    notes: "이전한 현재 매장으로 주소를 교정. 공개 메뉴판상 제주 9코스 단일 코스이므로 메뉴 누락이 아님",
  }),
  menuPriceStatus: "verified-single-course-menu",
});
replaceById(culinary, "culinary-class-wars-s1-86-1", researchedCulinaryKakaoPatch({
  restaurantName: "코치",
  address: "서울 성동구 성덕정17길 11 1층",
  region: "서울 성동구",
  phone: "",
  placeId: "1990658906",
  menus: [
    ...[
      ["다리살대파", 3800], ["볏짚에 구운 통허벅지", 4800], ["목살", 3800], ["연골", 3800],
      ["꼬리살", 3800], ["근막", 3800], ["고관절살", 3800], ["안심", 3800],
      ["다리안쪽살", 3800], ["어깨살", 3800], ["윗날개", 3800], ["날개", 3800],
      ["종아리살", 3800], ["껍질", 3500], ["염통", 3000], ["모래집", 3000],
    ].map(([name, price], index) => menu(name, price, "kakao-place-menu", index === 0)),
  ],
  notes: "영등포 야키토리 코치 폐점 후 성수의 현재 매장 코치로 연결하고 공개 꼬치 메뉴 16개 전체 반영",
}));
replaceById(culinary, "culinary-class-wars-s1-87-1", researchedCulinaryKakaoPatch({
  restaurantName: "포그",
  address: "서울 마포구 독막로2길 34 1층",
  region: "서울 마포구",
  phone: "0502-5551-6609",
  placeId: "1317622013",
  menus: [
    menu("포그", 7400, "kakao-place-menu", true),
    menu("알감자튀김", 4000, "kakao-place-menu"),
  ],
  notes: "대흥동 포그서울 폐점 후 현재 영업 중인 포그로 연결하고 공개 메뉴판 전체 반영",
}));
replaceById(culinary, "culinary-class-wars-s1-97-1", researchedCulinaryKakaoPatch({
  restaurantName: "제이드앤워터 옥수점",
  address: "서울 성동구 한림말3길 21-1 1층",
  region: "서울 성동구",
  phone: "02-2296-3003",
  placeId: "201349608",
  menus: [
    menu("옥앤수 몬테크리스토", 17000, "kakao-place-menu", true), menu("옥앤수 새우산도", 14000, "kakao-place-menu"),
    menu("초리조 라구 파스타", 21000, "kakao-place-menu"), menu("베이컨&치킨 시저", 15000, "kakao-place-menu"),
    menu("소세지스크램블", 21000, "kakao-place-menu"),
  ],
  notes: "기존 옥수점 이전 주소를 현재 주소로 교정하고 공개 메뉴판 5개 전체 반영",
}));
replaceById(culinary, "culinary-class-wars-s1-1-1", {
  ...researchedPatch({
    name: "비아 톨레도 파스타바",
    address: "서울 용산구 원효로83길 7-2 1층",
    region: "서울 용산구",
    phone: "0507-1384-0986",
    menus: [foreignMenu("계절 이탈리안 디너 코스", "149,000~159,000원(계절·구성별 변동)", "current-menu-via-toledo", true)],
    sourceLabel: "비아 톨레도 현재 코스 운영·가격대",
    sourceUrl: "https://infobaram.tistory.com/1000",
    notes: "단품 없이 계절 코스만 운영하는 식당으로 확인해 가격 없는 일반명 대신 현재 공개 코스 가격대를 반영",
  }),
  restaurantName: "비아 톨레도 파스타바",
  menuPriceStatus: "current-public-variable-course-price",
});
replaceById(culinary, "culinary-class-wars-s1-47-1", {
  ...researchedPatch({
    name: "가야가야",
    address: "서울 마포구 양화로10길 15 1층",
    region: "서울 마포구",
    phone: "02-363-7877",
    menus: [
      menu("돈코츠라멘", 10000, "current-menu-gayagaya", true),
      menu("돈코츠 챠슈멘", 12000, "current-menu-gayagaya"),
      menu("돈코츠 미소라멘", 10500, "current-menu-gayagaya"),
      menu("돈코츠 야사이 라멘", 12000, "current-menu-gayagaya"),
      menu("돈코츠 미소 야사이 라멘", 12500, "current-menu-gayagaya"),
      menu("돈코츠 교카이 라멘", 10500, "current-menu-gayagaya"),
      menu("돈코츠 교카이 야사이 라멘", 12500, "current-menu-gayagaya"),
      menu("돈코츠 교카이 차슈멘", 12500, "current-menu-gayagaya"),
    ],
    sourceLabel: "가야가야 2026년 현재 전체 공개 메뉴",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=ifpWsTLFWoEm",
    notes: "이전 후 합정 매장의 현재 라멘 8종과 가격을 전부 반영하고 전화번호를 교정",
  }),
  restaurantName: "가야가야",
  kakaoPlaceId: "1317607383",
  placeUrl: "https://place.map.kakao.com/1317607383",
  matchedPlaceName: "가야가야",
});
replaceById(culinary, "culinary-class-wars-s1-50-1", {
  ...researchedPatch({
    name: "July 줄라이",
    address: "서울 서초구 동광로 164",
    region: "서울 서초구",
    phone: "02-534-9544",
    menus: [
      menu("Lunch", 95000, "current-menu-july", true),
      menu("Dinner", 150000, "current-menu-july"),
    ],
    sourceLabel: "줄라이 2026년 현재 코스 메뉴",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=HcZODg8mLuze",
    notes: "과거 단품 메뉴가 섞인 10개 항목을 제거하고 현재 운영 중인 런치·디너 코스와 가격으로 교체",
  }),
  restaurantName: "July 줄라이",
});
replaceById(culinary, "culinary-class-wars-s1-81-4", {
  kakaoPlaceId: null,
  placeUrl: null,
  matchedPlaceName: null,
  menuPriceStatus: "public-menu-unavailable",
  menuPriceSources: [],
  reviewStatus: "manual-review-required",
  notes: "기존 카카오 연결은 식당이 아닌 복합상가 성수낙낙으로 확인되어 제거함",
});
const culinaryWithoutCurrentPublicMenu = new Set([
  "culinary-class-wars-s1-5-2", "culinary-class-wars-s1-8-3", "culinary-class-wars-s1-12-1",
  "culinary-class-wars-s1-16-1", "culinary-class-wars-s1-23-1", "culinary-class-wars-s1-33-1",
  "culinary-class-wars-s1-34-1", "culinary-class-wars-s1-34-2", "culinary-class-wars-s1-46-1",
  "culinary-class-wars-s1-48-1", "culinary-class-wars-s1-49-1", "culinary-class-wars-s1-49-2",
  "culinary-class-wars-s1-58-1", "culinary-class-wars-s1-60-1", "culinary-class-wars-s1-66-1",
  "culinary-class-wars-s1-66-3", "culinary-class-wars-s1-69-1", "culinary-class-wars-s1-71-2",
  "culinary-class-wars-s1-83-3", "culinary-class-wars-s1-88-1", "culinary-class-wars-s1-93-1",
]);
for (const id of culinaryWithoutCurrentPublicMenu) {
  const record = culinary.find((item) => item.id === id);
  if (!record) throw new Error(`Record not found: ${id}`);
  if ((record.menus ?? []).length) continue;
  replaceById(culinary, id, {
    menuPriceStatus: "closed-or-current-public-menu-unavailable",
    menuPriceVerifiedAt: verifiedAt,
    menuPriceSources: [],
    reviewStatus: "current-operation-review-required",
    notes: appendUniqueNote(record.notes, "기존 장소 링크가 종료되었고 현재 동일 식당의 공개 메뉴판을 확인하지 못해 임의 메뉴·가격을 생성하지 않음"),
  });
}
for (const id of ["culinary-class-wars-s1-14-1", "culinary-class-wars-s1-75-1"]) {
  const record = culinary.find((item) => item.id === id);
  if (!record) throw new Error(`Record not found: ${id}`);
  replaceById(culinary, id, {
    menuPriceStatus: "not-a-public-restaurant-menu",
    menuPriceVerifiedAt: verifiedAt,
    menuPriceSources: [],
    reviewStatus: "non-restaurant-affiliation-reviewed",
    notes: appendUniqueNote(record.notes, "농가 또는 게스트하우스 소속 정보로 확인되어 일반 식당 메뉴판 대상에서 제외"),
  });
}
markUnavailablePrices(culinary, { culinary: true });
await writeFile(culinaryPath, `${JSON.stringify(culinary, null, 2)}\n`, "utf8");

const season1 = JSON.parse(await readFile(seasonPath(1), "utf8"));
replaceById(season1, "jhmp-s1-e03-somunnanjukjip", researchedPatch({
  name: "소문난죽집",
  address: "부산 중구 중구로43번길 36",
  region: "부산 중구",
  phone: "051-244-7485",
  menus: [
    menu("호박죽 소", 5000, "current-menu-famous-porridge", true),
    menu("호박죽 대", 6000, "current-menu-famous-porridge"),
    menu("녹두죽 소", 5000, "current-menu-famous-porridge"),
    menu("녹두죽 대", 6000, "current-menu-famous-porridge"),
    menu("팥죽", 6000, "current-menu-famous-porridge"),
    menu("깨죽", 8000, "current-menu-famous-porridge"),
  ],
  sourceLabel: "소문난죽집 공개 전체 메뉴",
  sourceUrl: "https://keriai.com/793",
  notes: "죽 종류와 사이즈별 가격을 분리해 전체 반영",
}));
replaceById(season1, "jhmp-s1-e03-baekhwagopchang1", researchedPatch({
  name: "백화양곱창 1호",
  address: "부산 중구 자갈치로 23",
  region: "부산 중구",
  phone: "051-245-0105",
  menus: [
    menu("양", 45000, "current-menu-baekhwa"),
    menu("양(모듬) 소금구이", 39000, "current-menu-baekhwa", true),
    menu("양(모듬) 양념", 39000, "current-menu-baekhwa"),
    menu("볶음밥", 12000, "current-menu-baekhwa"),
  ],
  sourceLabel: "백화양곱창 1호 현재 전체 메뉴",
  sourceUrl: "https://www.diningcode.com/profile.php?rid=80jX1ehlNV0I",
  notes: "2025년 이후 공개 메뉴판의 4개 메뉴와 가격을 반영",
}));
replaceById(season1, "jhmp-s1-e04-dongbaekseomhoetjip", {
  ...researchedPatch({
    name: "동백섬횟집",
    address: "부산 해운대구 해운대해변로209번나길 17",
    region: "부산 해운대구",
    phone: "051-741-3888",
    menus: [
      foreignMenu("대게", "시가", "current-menu-dongbaek"),
      foreignMenu("계절자연산", "시가", "current-menu-dongbaek", true),
      ...[150000, 120000, 100000, 80000, 70000, 55000].map((price) => menu(`코스 ${price.toLocaleString("ko-KR")}원 구성`, price, "current-menu-dongbaek")),
      menu("세꼬시", 55000, "current-menu-dongbaek"),
      menu("회정식(점심특선)", 45000, "current-menu-dongbaek"),
      menu("물회(점심특선)", 30000, "current-menu-dongbaek"),
      menu("특회덮밥(점심특선)", 28000, "current-menu-dongbaek"),
      menu("회덮밥(점심특선)", 23000, "current-menu-dongbaek"),
      menu("식사", 2000, "current-menu-dongbaek"),
    ],
    sourceLabel: "동백섬횟집 현재 전체 메뉴",
    sourceUrl: "https://polle.com/place/36A7Fm/%EB%8F%99%EB%B0%B1%EC%84%AC%20%ED%9A%9F%EC%A7%91",
    notes: "가격 없는 제철 항목은 시가로 명시하고 코스·점심특선·추가 식사까지 전체 반영",
  }),
  menuPriceStatus: "current-public-full-menu-with-market-prices",
});
replaceById(season1, "jhmp-s1-e05-myeongpum", researchedPatch({
  name: "명품맛집",
  address: "전남 여수시 동문로 129-1 1층",
  region: "전남 여수시",
  phone: "061-662-0292",
  menus: [
    ...[
      ["게장백반", 15000], ["갈치조림", 25000], ["고등어구이", 15000],
      ["낙지볶음", 25000], ["서대회무침", 30000], ["갈치구이", 25000],
      ["제육볶음", 13000], ["백반", 12000], ["생낙지탕탕이", 30000],
    ].map(([name, price], index) => menu(name, price, "current-menu-luxury", index === 0)),
  ],
  sourceLabel: "명품맛집 현재 전체 메뉴",
  sourceUrl: "https://polle.com/place/2guxyk/%EB%AA%85%ED%92%88%EB%A7%9B%EC%A7%91",
  notes: "가격 없는 카카오 항목 16개를 제거하고 현재 공개 메뉴판 9개로 교체",
}));
replaceById(season1, "jhmp-s1-e06-namjin", {
  ...researchedPatch({
    name: "남진이네게장갈치명가",
    address: "전남 여수시 봉산1로 49 1층",
    region: "전남 여수시",
    phone: "061-642-6080",
    menus: [
      menu("순살갈치조림", 15000, "current-menu-namjin", true),
      menu("게장정식", 22000, "current-menu-namjin"),
      menu("갈치회무침 정식", 28000, "current-menu-namjin"),
      menu("갈치회 코스요리", 35000, "current-menu-namjin"),
      foreignMenu("생 갈치구이", "15,000원부터(크기별 변동)", "current-menu-namjin"),
      foreignMenu("특대 갈치구이", "시가", "current-menu-namjin"),
      foreignMenu("포장판매·전국택배", "품목·중량별 변동", "current-menu-namjin"),
    ],
    sourceLabel: "남진이네게장갈치명가 현재 전체 메뉴",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=75kF6HgGIYyA",
    notes: "방송 당시 음식명 3개만 있던 원본을 현재 주문 메뉴 7개와 고정가·변동가로 교체하고 상호·전화번호를 현행 정보로 교정",
  }),
  kakaoPlaceId: "427562430",
  placeUrl: "https://place.map.kakao.com/427562430",
  matchedPlaceName: "남진이네게장갈치명가",
  lat: 34.73541462,
  lng: 127.72404041,
  menuPriceStatus: "current-public-full-menu-with-market-prices",
});
replaceById(season1, "jhmp-s1-e09-gaboja", researchedPatch({
  name: "가보자토종순대국밥뼈다귀해장국",
  address: "강원 홍천군 홍천읍 홍천로3길 6",
  region: "강원 홍천군",
  phone: "0507-1386-1577",
  menus: [
    ...[
      ["순대국 보통", 10000], ["순대국 특", 12000], ["얼큰이순대국 보통", 11000],
      ["얼큰이순대국 특", 13000], ["뼈해장국 보통", 11000], ["뼈해장국 특", 14000],
      ["술국", 25000], ["얼큰술국", 28000], ["순대찜 소", 10000], ["순대찜 대", 20000],
      ["수육 중", 20000], ["수육 대", 25000], ["곱창전골 중", 33000], ["곱창전골 대", 38000],
      ["곱창볶음 중", 33000], ["곱창볶음 대", 38000], ["감자탕 소", 32000],
      ["감자탕 중", 40000], ["감자탕 대", 48000], ["공기밥", 1000],
      ["배추김치 추가", 2000], ["깍두기 추가", 2000], ["양념 추가", 500], ["들깨 추가", 500],
      ["새우젓 추가", 500], ["다진고추 추가", 500], ["고추기름 추가", 500],
      ["콜라", 2000], ["사이다", 2000],
    ].map(([name, price], index) => menu(name, price, "current-menu-gaboja", index === 4)),
  ],
  sourceLabel: "가보자토종순대국밥 현재 전체 메뉴",
  sourceUrl: "https://www.diningcode.com/profile.php?rid=I57MFabIMePn",
  notes: "대표 뼈해장국 1개만 있던 원본을 식사·전골·탕·추가 메뉴 29개로 보완",
}));
replaceById(season1, "jhmp-s1-e13-noanjip", researchedPatch({
  name: "나주곰탕 노안집",
  address: "전남 나주시 금성관길 1-3",
  region: "전남 나주시",
  phone: "061-333-2053",
  menus: [
    menu("나주곰탕", 12000, "current-menu-noanjip", true),
    menu("수육곰탕", 14000, "current-menu-noanjip"),
    menu("수육 소", 35000, "current-menu-noanjip"),
    menu("수육 대", 50000, "current-menu-noanjip"),
    menu("소주", 4000, "current-menu-noanjip"),
    menu("막걸리", 4000, "current-menu-noanjip"),
  ],
  sourceLabel: "나주곰탕 노안집 현재 전체 메뉴",
  sourceUrl: "https://polle.com/place/2VvnVe/%EB%82%98%EC%A3%BC%EA%B3%B0%ED%83%95%20%EB%85%B8%EC%95%88%EC%A7%91",
  notes: "최근 공개 메뉴판 6개와 가격을 반영",
}));
replaceById(season1, "jhmp-s1-e12-bangchon", {
  kakaoPlaceId: null,
  placeUrl: null,
  matchedPlaceName: null,
  menuPriceStatus: "broadcast-menu-partial-prices",
  menuPriceSources: [{ label: "전현무계획 시즌1 방영 당시 메뉴", url: "https://www.mbn.co.kr/vod/programContents/966/6052" }],
  reviewStatus: "manual-review-required",
  notes: "기존 카카오 연결은 식당이 아닌 방촌시장 전체 장소로 확인되어 제거함. 방송 확인 메뉴는 보존함.",
});
markUnavailablePrices(season1);
await writeFile(seasonPath(1), `${JSON.stringify(season1, null, 2)}\n`, "utf8");

const season2 = JSON.parse(await readFile(seasonPath(2), "utf8"));
replaceById(season2, "jhmp-s2-directory-008", {
  ...researchedPatch({
    name: "코끼리만두",
    address: "서울 강서구 공항대로51길 27",
    region: "서울 강서구",
    phone: "02-3662-1215",
    menus: [menu("김치만두 6개", 8000, "current-menu-elephant-dumpling", true)],
    sourceLabel: "코끼리만두 2026년 현재 메뉴",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=9rKDDwOTZvvS",
    notes: "과거 지도에 남은 만둣국·냉면류를 현재 메뉴로 오인하지 않도록 제외. 2026년 방문 정보상 김치만두 단일 메뉴로 운영",
  }),
  menuPriceStatus: "verified-current-single-menu",
});
replaceById(season2, "jhmp-s2-directory-052", researchedPatch({
  name: "영동횟집",
  address: "강원 강릉시 창해로350번길 37",
  region: "강원 강릉시",
  phone: "0507-1386-6384",
  menus: [
    menu("짬뽕물회 2인", 44000, "current-menu-yeongdong", true),
    menu("잡어(자연산모듬) 소", 120000, "current-menu-yeongdong"),
    menu("잡어(자연산모듬) 중", 160000, "current-menu-yeongdong"),
    menu("잡어(자연산모듬) 대", 200000, "current-menu-yeongdong"),
    menu("우럭미역국 1인", 12000, "current-menu-yeongdong"),
  ],
  sourceLabel: "영동횟집 현재 전체 메뉴",
  sourceUrl: "https://www.tel-co.net/food/spot/4400",
  notes: "과거 28개 세부 음식명은 코스 상차림을 개별 메뉴로 센 것이어서 제외하고 현재 실제 주문 메뉴 5개로 정리",
}));
replaceById(season2, "jhmp-s2-directory-059", {
  ...researchedPatch({
    name: "산동포자",
    address: "인천 부평구 마장로 75 대경빌딩",
    region: "인천 부평구",
    phone: "032-431-8885",
    menus: [
      menu("홍소스즈토우", 30000, "current-menu-shandong", true),
      menu("바지락볶음", 21000, "current-menu-shandong"),
      menu("꿔바로우", 30000, "current-menu-shandong"),
      menu("해파리냉채", 30000, "current-menu-shandong"),
    ],
    sourceLabel: "산동포자 공개 당일 요리 메뉴·가격",
    sourceUrl: "https://keriai.com/968",
    notes: "고정 전체 메뉴판이 아니라 재료에 따라 오늘의 요리가 바뀌는 식당. 공개된 현재 가격 메뉴만 저장하고 오래된 지도상의 무가격 메뉴는 제외",
  }),
  menuPriceStatus: "verified-rotating-daily-menu",
});
replaceById(season2, "jhmp-s2-directory-076", {
  ...researchedPatch({
    name: "호루몬",
    address: "서울 강남구 언주로152길 11-5 2층",
    region: "서울 강남구",
    phone: "010-2893-7873",
    menus: [
      menu("소내장 오마카세", 45000, "current-menu-horumon", true),
      menu("하프코스(식사류 제외)", 25000, "current-menu-horumon"),
    ],
    sourceLabel: "호루몬 현재 코스·가격",
    sourceUrl: "https://polle.com/place/4Uy7tr/%ED%98%B8%EB%A3%A8%EB%AA%AC",
    notes: "여러 내장 요리는 개별 판매가 아니라 코스 구성으로 확인되어 전체·하프 코스 가격으로 정리",
  }),
  menuPriceStatus: "verified-current-two-course-menu",
});
replaceById(season2, "jhmp-s2-directory-098", researchedPatch({
  name: "우노네",
  address: "서울 마포구 월드컵북로48길 33-7 1층",
  region: "서울 마포구",
  phone: "02-6203-1315",
  menus: [
    ...[
      ["판자넬라 샐러드", 20000], ["시저 샐러드", 20000], ["해산물 튀김", 25000],
      ["관자", 25000], ["살라미보드", 35000], ["마리나라", 20000],
      ["마르게리따", 21000], ["콰트로치즈", 26000], ["부팔라 마르게리따", 26000],
      ["카프리쵸사", 28000], ["살시챠 & 열무", 28000], ["프로슈토 & 루꼴라", 30000],
      ["모르따델라", 30000], ["비스마르크", 32000], ["깔조네", 32000],
      ["봉골레", 25000], ["초리조새우", 25000], ["화이트라구", 28000],
      ["까르보나라", 28000], ["아마트리치아나", 28000], ["해산물 링귀니", 30000],
      ["트러플과 모렐", 39000],
    ].map(([name, price], index) => menu(name, price, "current-menu-unone", index === 6)),
  ],
  sourceLabel: "우노네 현재 공개 전체 메뉴",
  sourceUrl: "https://polle.com/place/4YRhEn/%EC%9A%B0%EB%85%B8%EB%84%A4",
  notes: "카카오의 음식 종류 수준 5개 항목을 실제 현재 메뉴판 22개로 교체",
}));
replaceById(season2, "jhmp-s2-directory-122", researchedPatch({
  name: "수타혜미칼국수",
  address: "부산 남구 문현금융로 4",
  region: "부산 남구",
  phone: "051-635-8587",
  menus: [
    menu("손칼국수", 5000, "current-menu-hyemi", true),
    menu("냉칼국수", 5000, "current-menu-hyemi"),
    menu("비빔칼국수", 6000, "current-menu-hyemi"),
    menu("국수", 5000, "current-menu-hyemi"),
    menu("냉국수", 5000, "current-menu-hyemi"),
  ],
  sourceLabel: "수타혜미칼국수 현재 전체 메뉴",
  sourceUrl: "https://www.tel-co.net/food/spot/8376",
  notes: "현재 공개 메뉴판 5개 전부의 가격을 반영",
}));
replaceById(season2, "jhmp-s2-directory-119", {
  ...researchedPatch({
    name: "연락골고추장추어탕",
    address: "경기 김포시 통진읍 월하로 337",
    region: "경기 김포시",
    phone: "031-982-7735",
    menus: [
      menu("고추장추어탕+솥밥(갈은 미꾸라지)", 11000, "current-menu-loach", true),
      menu("고추장추어탕+솥밥(통 미꾸라지)", 11000, "current-menu-loach"),
    ],
    sourceLabel: "연락골고추장추어탕 현재 전체 메뉴",
    sourceUrl: "https://polle.com/place/2GkWgz/%EA%B3%A0%EC%B6%94%EC%9E%A5%20%EC%B6%94%EC%96%B4%ED%83%95",
    notes: "실제 지도 상호를 반영하고 갈은 것·통 미꾸라지 두 선택 메뉴 가격을 모두 저장",
  }),
  menuPriceStatus: "verified-current-two-menu-restaurant",
});
replaceById(season2, "jhmp-s2-directory-144", researchedPatch({
  name: "진성식당",
  address: "제주 서귀포시 대정읍 추사로 47",
  region: "제주 서귀포시",
  phone: "064-794-0258",
  menus: [
    menu("제주산 삼겹살 200g+묵은지", 18000, "current-menu-jinseong", true),
    menu("짜글이", 10000, "current-menu-jinseong"),
    menu("묵은지 닭볶음탕", 60000, "current-menu-jinseong"),
  ],
  sourceLabel: "진성식당 현재 전체 메뉴",
  sourceUrl: "https://www.tabling.co.kr/place/677cd01166de5f069885647d",
  notes: "과거 지번 주소를 현재 도로명 주소로 보완하고 현재 공개 메뉴판 3개 전부 반영",
}));
replaceById(season2, "jhmp-s2-directory-035", researchedPatch({
  name: "유치회관",
  address: "경기 수원시 팔달구 효원로292번길 67",
  region: "경기 수원시 팔달구",
  phone: "031-234-6275",
  menus: [
    menu("해장국", 11000, "secondary-menu-yuchihoegwan", true),
    menu("수육", 35000, "secondary-menu-yuchihoegwan"),
    menu("수육무침", 35000, "secondary-menu-yuchihoegwan"),
    menu("소주", 5000, "secondary-menu-yuchihoegwan"),
  ],
  sourceLabel: "유치회관 방송 당시 전체 메뉴판",
  sourceUrl: "https://nopo.haedory.com/2025/09/37.html",
  notes: "전현무계획2 수원 해장국 식당 상호·주소와 공개 메뉴판 확인",
}));
replaceById(season2, "jhmp-s2-directory-047", researchedPatch({
  name: "뉴욕통닭",
  address: "대구광역시 중구 종로 12",
  region: "대구 중구",
  phone: "053-253-0070",
  menus: [
    menu("후라이드치킨", 23000, "secondary-menu-newyork-chicken", true),
    menu("양념치킨", 25000, "secondary-menu-newyork-chicken"),
    menu("찜닭", 32000, "secondary-menu-newyork-chicken"),
  ],
  sourceLabel: "뉴욕통닭 공개 메뉴판",
  sourceUrl: "https://moneydory.tistory.com/190",
  notes: "전현무계획2 대구 전설의 치킨집 상호·주소와 공개 메뉴판 확인",
}));
replaceById(season2, "jhmp-s2-directory-049", researchedPatch({
  name: "동해안",
  address: "강원 삼척시 청석로 74 석미아파트상가 1층",
  region: "강원 삼척시",
  phone: "033-574-1612",
  menus: [
    menu("문어+수제비", null, "secondary-menu-donghaean", true),
    menu("골뱅이", null, "secondary-menu-donghaean"),
    menu("과메기(계절메뉴)", null, "secondary-menu-donghaean"),
  ],
  sourceLabel: "동해안 방송 식당·메뉴 확인",
  sourceUrl: "https://moneydory.tistory.com/186",
  notes: "공개 글에서 메뉴명은 확인됐지만 가격은 이미지로만 제공되어 미확인 처리함",
}));
replaceById(season2, "jhmp-s2-directory-140", researchedPatch({
  name: "영광보쌈",
  address: "서울 마포구 만리재로1길 14",
  region: "서울 마포구",
  phone: "02-716-0873",
  menus: [
    menu("보쌈(2인 기준)", 28000, "secondary-menu-yeonggwang-bossam", true),
    menu("생굴 추가(계절메뉴)", 13000, "secondary-menu-yeonggwang-bossam"),
  ],
  sourceLabel: "영광보쌈 공개 메뉴판",
  sourceUrl: "https://i2m.haedory.com/2026/04/jeonhyunmooplan2-gongdeok-yeonggwangbossam.html",
  notes: "전현무계획2 공덕 보쌈 식당 상호·주소와 공개 메뉴판 확인",
}));
replaceById(season2, "jhmp-s2-directory-002", {
  ...researchedPatch({
    name: "태극당 본점",
    address: "서울 중구 동호로24길 7",
    region: "서울 중구",
    phone: "02-2279-3152",
    menus: [
      foreignMenu("단팥빵", null, "secondary-menu-taegeukdang"),
      foreignMenu("야채사라다빵", "약 5,300~7,000원", "secondary-menu-taegeukdang", true),
      foreignMenu("모나카", "약 2,800원", "secondary-menu-taegeukdang", true),
      foreignMenu("찹쌀모나카", "약 3,300원", "secondary-menu-taegeukdang"),
      foreignMenu("버터케이크", null, "secondary-menu-taegeukdang"),
    ],
    sourceLabel: "태극당 본점 공개 메뉴·가격 자료",
    sourceUrl: "https://nopo.haedory.com/2025/09/29.html",
    notes: "베이커리 특성상 전체 품목과 가격이 계절·재고에 따라 달라져 공개 확인된 대표 품목과 가격 범위를 반영",
  }),
  menuPriceStatus: "public-bakery-menu-partial",
});
replaceById(season2, "jhmp-s2-directory-017", researchedPatch({
  name: "문성5호",
  address: "경기 안산시 단원구 대부황금로 1209",
  region: "경기 안산시 단원구",
  phone: "",
  menus: [
    menu("민어탕(1인)", 20000, "secondary-menu-munseong5", true),
    menu("박대 10미 별도 포장", 35000, "secondary-menu-munseong5"),
  ],
  sourceLabel: "문성5호 방송 당시 메뉴판",
  sourceUrl: "https://keriai.com/1130",
  notes: "공개 메뉴판에서 확인되는 식사·포장 판매 품목 전체를 반영",
}));
replaceById(season2, "jhmp-s2-directory-028", researchedPatch({
  name: "동락식당",
  address: "전남 영광군 영광읍 중앙로 191-3",
  region: "전남 영광군",
  phone: "061-351-3363",
  menus: [
    menu("37첩 영광굴비 한정식(4인)", 100000, "secondary-menu-dongrak", true),
    menu("37첩 영광굴비 한정식 특선(4인)", 150000, "secondary-menu-dongrak"),
    menu("37첩 영광굴비 한정식 상견례(4인)", 200000, "secondary-menu-dongrak"),
  ],
  sourceLabel: "동락식당 굴비 한정식 가격 자료",
  sourceUrl: "https://v.daum.net/v/0O5grRqyts",
  notes: "낱개 반찬 가격이 아닌 37첩 한정식 코스의 공개된 세 가지 가격 구성을 반영",
}));
replaceById(season2, "jhmp-s2-directory-029", {
  ...researchedPatch({
    name: "한성식당",
    address: "전남 영광군 영광읍 천마길 12",
    region: "전남 영광군",
    phone: "061-352-6253",
    menus: [menu("백합죽(1인)", 18000, "secondary-menu-hanseong", true)],
    sourceLabel: "한성식당 현재 공개 메뉴",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=E5CvuqadBjno",
    notes: "누락이 아니라 현재 공개 메뉴판상 백합죽 단일메뉴로 확인",
  }),
  menuPriceStatus: "verified-single-menu",
});
replaceById(season2, "jhmp-s2-directory-030", {
  ...researchedPatch({
    name: "놀부네",
    address: "전남 영광군 영광읍 천년로11길 26-1",
    region: "전남 영광군",
    phone: "061-351-6888",
    menus: [
      menu("덕자조림(1인)", 30000, "diningcode-nolbune", true),
      foreignMenu("덕자회", "시가", "secondary-menu-nolbune"),
      foreignMenu("민어회(계절메뉴)", "시가", "secondary-menu-nolbune"),
      foreignMenu("굴비정식", "약 20,000원/인", "secondary-menu-nolbune"),
      menu("공기밥", 1000, "diningcode-nolbune"),
      menu("단호박전 추가", 5000, "secondary-menu-nolbune"),
    ],
    sourceLabel: "놀부네 계절 메뉴·가격 공개 자료",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=1tasFejxQ1Ej",
    notes: "제철 생선 전문점이라 메뉴와 가격이 계절·어획량에 따라 변동. 고정 공개가와 시가 정보를 구분해 반영",
  }),
  menuPriceStatus: "seasonal-menu-market-price",
});
replaceById(season2, "jhmp-s2-directory-036", {
  ...researchedPatch({
    name: "Sun Hing Restaurant",
    address: "Shop C, G/F, Markfield Building, 8 Smithfield, Kennedy Town, Hong Kong",
    region: "Hong Kong",
    phone: "",
    menus: [
      ...[
        "Steamed Beef Balls with Bean Curd Skin", "Seasonal Vegetables Dace Fish Ball", "Golden Steamed Sponge Cake",
        "Chiu Chow Dumpling", "Buddha's Delight Rice Roll", "Turnip Cake with Cured Meat", "Glutinous Rice Bun",
        "Egg Yolk Lotus Seed Bun", "Honey Roasted Pork Bun", "Steamed Chicken Bun",
        "Roasted Pork Roll with Fermented Red Beancurd", "Quail Egg Siu Mai", "Steamed Rice Roll with Shredded Chicken",
      ].map((name) => foreignMenu(name, "HK$ 29", "foodpanda-sun-hing")),
      ...[
        "Steamed Tofu with Shrimp Paste", "Steamed Rice Roll with Coriander and Beef",
        "Steamed Rice Roll with Honey Barbecued Pork", "Steamed Rice Roll with Spring Onion and Dried Shrimp",
        "Steamed Rice Roll", "Pork Liver Dumpling",
      ].map((name) => foreignMenu(name, "HK$ 31", "foodpanda-sun-hing")),
      ...[
        "Pan-fried Pork Ribs with Taro", "Steamed Chicken Feet with Soy Sauce", "Beancurd Sheet Roll with Oyster Sauce",
        "Curry Honeycomb Tripe", "Black Pepper Pig Tripe", "Salted Egg Yolk Custard Bun",
      ].map((name) => foreignMenu(name, "HK$ 32", "foodpanda-sun-hing")),
      ...[
        "Shrimp and Vegetable Sprout Dumpling", "Steamed Glutinous Rice with Chicken Wrapped in Lotus Leaf",
        "Pea Shoot Shrimp Dumpling", "Scallop and Needle Mushroom Dumpling",
      ].map((name) => foreignMenu(name, "HK$ 34", "foodpanda-sun-hing")),
      ...[
        "Sun Hing Shrimp Dumpling", "Steamed Chicken with Beancurd Sheet Roll",
        "Steamed Duck Feet with Beancurd Sheet Roll and Taro", "Siu Mai with Crab Brown Meat",
        "Steamed Chicken with Fish Maw", "Pork and Mushroom Dumpling",
      ].map((name) => foreignMenu(name, "HK$ 35", "foodpanda-sun-hing")),
      ...[
        "Soy Sauce Ribs Rice", "Mushroom Chicken Rice", "Coriander Beef Rice",
        "Salted Fish and Sliced Meat Rice", "Preserved Vegetables and Meat Patty Rice",
      ].map((name) => foreignMenu(name, "HK$ 36", "foodpanda-sun-hing")),
    ],
    sourceLabel: "Sun Hing Restaurant 현재 공개 배달 전체 메뉴",
    sourceUrl: "https://www.foodpanda.hk/chain/cu8vk/sun-hing-restaurant",
    notes: "방송용 가칭 '홍콩 맛집'을 실제 식당으로 식별하고 공개 주문 페이지의 40개 메뉴와 정상가를 반영",
  }),
  isOverseas: true,
  menuPriceStatus: "current-delivery-full-menu",
});
replaceById(season2, "jhmp-s2-directory-038", {
  ...researchedPatch({
    name: "중앙토굴새우젓",
    address: "충남 홍성군 광천읍 광천로 146",
    region: "충남 홍성군",
    phone: "",
    menus: [
      foreignMenu("새우젓 1kg(추젓·오젓·육젓 등)", "30,000~100,000원", "secondary-menu-jungang-jeot", true),
      menu("명란젓 1kg", 40000, "secondary-menu-jungang-jeot"),
      menu("오징어젓", 30000, "secondary-menu-jungang-jeot"),
      foreignMenu("꼴뚜기젓", null, "secondary-menu-jungang-jeot"),
      foreignMenu("낙지젓", null, "secondary-menu-jungang-jeot"),
    ],
    sourceLabel: "중앙토굴새우젓 2025 판매 품목·가격",
    sourceUrl: "https://keriai.com/1054",
    notes: "식당이 아닌 젓갈 판매점. 품종·등급에 따라 달라지는 새우젓은 가격 범위로 저장하고 공개 가격이 없는 젓갈은 품목만 반영",
  }),
  menuPriceStatus: "retail-products-partial-prices",
});
replaceById(season2, "jhmp-s2-directory-048", researchedPatch({
  name: "원조할매묵집",
  address: "대구 달서구 월배로28안길 9",
  region: "대구 달서구",
  phone: "053-632-8994",
  menus: [
    menu("메밀묵채", 8000, "secondary-menu-halme-muk", true),
    menu("도토리묵채(가을 계절메뉴)", 9000, "secondary-menu-halme-muk"),
    menu("촌두부김치", 7000, "secondary-menu-halme-muk"),
    menu("닭도리탕", 45000, "secondary-menu-halme-muk"),
    foreignMenu("정구지찌짐", null, "secondary-menu-halme-muk"),
  ],
  sourceLabel: "원조할매묵집 방송 당시 메뉴판",
  sourceUrl: "https://new.haedory.com/288",
  notes: "공개 메뉴판 전체를 반영했으며 정구지찌짐은 품목만 확인되고 가격 표기가 없어 미확인 처리",
}));
replaceById(season2, "jhmp-s2-directory-049", {
  ...researchedPatch({
    name: "동해안",
    address: "강원 삼척시 청석로 74 석미한아름아파트상가 1층",
    region: "강원 삼척시",
    phone: "033-574-1612",
    menus: [
      foreignMenu("문어숙회+수제비", "시가", "secondary-menu-donghaean", true),
      foreignMenu("골뱅이", null, "secondary-menu-donghaean"),
      foreignMenu("과메기(계절메뉴)", null, "secondary-menu-donghaean"),
    ],
    sourceLabel: "동해안 방송 식당·메뉴 가격 확인",
    sourceUrl: "https://cooinglog.tistory.com/entry/%EC%A0%84%ED%98%84%EB%AC%B4%EA%B3%84%ED%9A%8D-2-%EB%AC%B8%EC%96%B4%EC%88%99%ED%9A%8C-%EC%88%98%EC%A0%9C%EB%B9%84-%EA%B3%A8%EB%B1%85%EC%9D%B4-%EC%82%BC%EC%B2%99-%EB%8F%99%ED%95%B4%EC%95%88-%EC%A0%95%EB%B3%B4",
    notes: "문어숙회는 고정가가 아닌 시가로 확인. 다른 계절 메뉴는 공개 가격이 없어 임의 가격을 넣지 않음",
  }),
  menuPriceStatus: "market-price-and-partial-public-menu",
});
replaceById(season2, "jhmp-s2-directory-071", {
  ...researchedPatch({
    name: "센료스시(千両寿し)",
    address: "1-chōme-11 Chūōdōri, Tokushima, 770-0936, Japan",
    region: "Tokushima, Japan",
    phone: "",
    menus: [
      foreignMenu("오마카세", null, "secondary-menu-senryo", true),
      foreignMenu("계란초밥", null, "secondary-menu-senryo"),
      foreignMenu("도미초밥", null, "secondary-menu-senryo"),
      foreignMenu("방어초밥", null, "secondary-menu-senryo"),
      foreignMenu("코하다초밥", null, "secondary-menu-senryo"),
      foreignMenu("유자 계란국", null, "secondary-menu-senryo"),
    ],
    sourceLabel: "센료스시 공개 방송 메뉴 기록",
    sourceUrl: "https://food.stolencheese.com/en-US/%40moonoplan-fooding/posts/Senryo-Sushi-IkQrqEsaLjRJ",
    notes: "방송용 가칭 '스시 오마카세'를 실제 상호·주소로 교정. 공개 가격표가 없어 메뉴명만 보존",
  }),
  isOverseas: true,
});
replaceById(season2, "jhmp-s2-directory-072", {
  ...researchedPatch({
    name: "후나모토우동 다카시마 본점(舩本うどん 高島本店)",
    address: "Nakajima-25-2 Narutochō Takashima, Naruto, Tokushima 772-0051, Japan",
    region: "Tokushima, Japan",
    phone: "",
    menus: [
      foreignMenu("후나모토우동(나루토우동)", "¥430", "official-menu-funamoto", true),
      foreignMenu("떡튀김", "¥100/개", "official-menu-funamoto"),
      foreignMenu("오뎅 모둠", "¥120~", "official-menu-funamoto"),
      foreignMenu("고로케", "¥150", "official-menu-funamoto"),
      foreignMenu("치쿠와튀김", "¥150", "official-menu-funamoto"),
      foreignMenu("닭튀김", "¥350", "official-menu-funamoto"),
      foreignMenu("붓카케우동", "¥750", "official-menu-funamoto"),
      foreignMenu("생간장우동", "¥530", "official-menu-funamoto"),
    ],
    sourceLabel: "후나모토우동 공식 전체 메뉴",
    sourceUrl: "https://funamoto-udon.com/menu.html",
    notes: "방송용 가칭 '나루토 우동'을 실제 상호로 교정하고 공식 사이트에 공개된 전체 메뉴와 가격 반영",
  }),
  isOverseas: true,
  menuPriceStatus: "official-current-full-menu",
});
replaceById(season2, "jhmp-s2-directory-073", {
  name: "야키니쿠 전문점 와규(焼肉専門店 和牛)",
  address: "徳島県徳島市秋田町2丁目36, 770-0934 Japan",
  region: "Tokushima, Japan",
  phone: "088-622-6606",
  isOverseas: true,
  menus: [
    foreignMenu("아와규 야키니쿠", null, "broadcast-menu-wagyu", true),
    foreignMenu("아와규 스키야키", null, "broadcast-menu-wagyu"),
    foreignMenu("아와규 샤부샤부", null, "public-review-wagyu"),
  ],
  representativeMenu: "아와규 야키니쿠, 아와규 스키야키, 아와규 샤부샤부",
  menuPriceStatus: "public-menu-without-prices",
  menuPriceVerifiedAt: verifiedAt,
  menuPriceSources: [
    { label: "와규 현지 식당 정보", url: "https://tabelog.com/kr/tokushima/A3601/A360101/36001254/" },
    { label: "전현무계획2 방송 메뉴 기록", url: "https://gastronomic2022.tistory.com/3077" },
  ],
  reviewStatus: "menu-address-reviewed",
  confidence: 0.9,
  notes: "전화번호로 일본 상호 和牛와 정확한 번지를 확정. 현지 공개 페이지에는 메뉴 가격표가 없어 방송·리뷰에서 확인된 조리 방식만 저장",
});
replaceById(season2, "jhmp-s2-directory-074", {
  ...researchedPatch({
    name: "오토기노쿠니(おとぎの国)",
    address: "徳島県鳴門市撫養町小桑島字西37-2",
    region: "Tokushima, Japan",
    phone: "088-686-1443",
    menus: [
      foreignMenu("오코노미야키 마메다마", "¥670", "tabelog-review-otoginokuni", true, "2025-06-01"),
      foreignMenu("파·모찌·치즈 오코노미야키", "¥840", "tabelog-review-otoginokuni", false, "2025-06-01"),
      foreignMenu("토마토치즈 오코노미야키", "¥840", "tabelog-review-otoginokuni", false, "2025-06-01"),
      foreignMenu("아이스커피", "¥450", "tabelog-review-otoginokuni", false, "2025-06-01"),
    ],
    sourceLabel: "오토기노쿠니 2025 현지 공개 리뷰 메뉴",
    sourceUrl: "https://tabelog.com/kr/tokushima/A3601/A360102/36002165/",
    notes: "공식 가격표가 아닌 2025년 6월 현지 방문 기록에서 직접 확인된 메뉴만 반영",
  }),
  isOverseas: true,
  menuPriceStatus: "review-menu-partial",
});
replaceById(season2, "jhmp-s2-directory-075", {
  ...researchedPatch({
    name: "츄카소바 카와이(中華そば かわい)",
    address: "徳島県徳島市川内町加賀須野436-4",
    region: "Tokushima, Japan",
    phone: "088-665-2162",
    menus: [
      foreignMenu("중화소바 소", "¥700", "tabelog-kawai", true),
      foreignMenu("중화소바 대", null, "secondary-menu-kawai"),
      foreignMenu("계란 중화소바 소", "¥750", "secondary-menu-kawai", false, "2024-01-01"),
      foreignMenu("고기 중화소바 소", "¥750", "secondary-menu-kawai"),
      foreignMenu("고기+계란 중화소바 소", "¥900", "secondary-menu-kawai"),
      foreignMenu("밥", "¥150", "secondary-menu-kawai"),
      foreignMenu("맥주", null, "secondary-menu-kawai"),
      foreignMenu("사케", null, "secondary-menu-kawai"),
    ],
    sourceLabel: "츄카소바 카와이 현지 메뉴·리뷰",
    sourceUrl: "https://tabelog.com/kr/tokushima/A3601/A360101/36003040/",
    notes: "최신 방문 기록의 기본 소바 가격과 공개 메뉴 목록을 결합. 가격을 확인하지 못한 대 사이즈·주류는 미확인 처리",
  }),
  isOverseas: true,
  menuPriceStatus: "current-public-menu-partial-prices",
});
replaceById(season2, "jhmp-s2-directory-116", researchedPatch({
  name: "을지수제비",
  address: "서울 중구 충무로 40-1",
  region: "서울 중구",
  phone: "02-2266-9196",
  menus: [
    menu("수제비", 10000, "diningcode-eulji", true), menu("칼국수", 10000, "diningcode-eulji"),
    menu("감자전", 12000, "diningcode-eulji"), menu("김치전", 12000, "diningcode-eulji"),
    menu("두부전", 10000, "diningcode-eulji"), menu("콩국수", 13000, "diningcode-eulji"),
    menu("열무국수", 10000, "diningcode-eulji"), menu("두부김치", 16000, "diningcode-eulji"),
    menu("파전", 16000, "diningcode-eulji"), menu("열무비빔밥", 10000, "diningcode-eulji"),
    menu("모둠전", 16000, "diningcode-eulji"), menu("굴전", 13000, "diningcode-eulji"),
    menu("생선전", 13000, "diningcode-eulji"),
  ],
  sourceLabel: "을지수제비 현재 공개 전체 메뉴",
  sourceUrl: "https://www.diningcode.com/profile.php?rid=lGYf1WI8hqCq",
  notes: "공개 메뉴판의 식사·전류 13개와 가격을 모두 반영",
}));
replaceById(season2, "jhmp-s2-directory-055", {
  ...researchedPatch({
    name: "연남서식당",
    address: "서울 서대문구 연희맛로 15",
    region: "서울 서대문구",
    phone: "02-716-2520",
    menus: [
      menu("양념 소갈비(1대)", 19000, "secondary-menu-yeonnam-seo", true),
      menu("김치", 1500, "secondary-menu-yeonnam-seo"),
      menu("햇반", 1500, "secondary-menu-yeonnam-seo"),
      menu("소주", 4000, "secondary-menu-yeonnam-seo"),
    ],
    sourceLabel: "연남서식당 현재 공개 메뉴",
    sourceUrl: "https://toudy.tistory.com/entry/%EC%A0%84%ED%98%84%EB%AC%B4%EA%B3%84%ED%9A%8D-%EC%84%9C%EC%84%9C%EA%B0%88%EB%B9%84-%EC%9B%90%EC%A1%B0-%EC%97%B0%ED%9D%AC%EB%8F%99-%EC%86%8C%EA%B0%88%EB%B9%84-%EB%A7%9B%EC%A7%91-%EC%97%B0%EB%82%A8%EC%84%9C%EC%8B%9D%EB%8B%B9-%EC%A0%84%EC%9C%A0%EC%A7%84-%EC%86%90%ED%83%9C%EC%A7%84%ED%8E%B8-29%ED%99%94",
    notes: "방송용 가칭 '신촌 서서갈비 원조'를 이전 후 실제 상호로 교정. 고기는 단일메뉴이며 판매 부식·주류 포함",
  }),
  menuPriceStatus: "verified-single-main-menu-plus-extras",
});
replaceById(season2, "jhmp-s2-directory-057", {
  ...researchedPatch({
    name: "명각이네식당",
    address: "서울 영등포구 버드나루로12가길 25",
    region: "서울 영등포구",
    phone: "02-2677-2287",
    menus: [
      menu("월요일 된장찌개 백반", 8000, "secondary-menu-myeonggak"),
      menu("화요일 동태찌개 백반", 8000, "secondary-menu-myeonggak"),
      menu("수요일 제육볶음 백반", 8000, "secondary-menu-myeonggak", true),
      menu("목요일 생선정식", 8000, "secondary-menu-myeonggak"),
      menu("금요일 찌개정식", 8000, "secondary-menu-myeonggak"),
    ],
    sourceLabel: "명각이네식당 요일별 전체 백반 메뉴",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=ADNG6yPfNJPT",
    notes: "선택식 메뉴판이 아니라 요일마다 한 가지 백반을 내는 식당으로, 공개된 월~금 구성을 각각 저장",
  }),
  menuPriceStatus: "verified-rotating-daily-menu",
});
replaceById(season2, "jhmp-s2-directory-066", {
  ...researchedPatch({
    name: "해동수산",
    address: "광주 서구 천변좌로 262 양동시장 577호",
    region: "광주 서구",
    phone: "062-369-3794",
    menus: [
      menu("국내산 홍어 1kg", 70000, "secondary-menu-haedong", true),
      menu("칠레산 홍어 1kg", 60000, "secondary-menu-haedong"),
      menu("홍어무침", 50000, "secondary-menu-haedong"),
      foreignMenu("홍어애", null, "broadcast-menu-haedong"),
      foreignMenu("홍어삼합", null, "broadcast-menu-haedong"),
      foreignMenu("삭힌 홍어 단계별 시식", null, "broadcast-menu-haedong"),
    ],
    sourceLabel: "해동수산 공개 판매 메뉴·가격",
    sourceUrl: "https://keriai.com/1013",
    notes: "시장 판매점에서 방송상 차림으로 제공된 홍어애·삼합은 별도 고정가가 공개되지 않아 임의 가격을 넣지 않음",
  }),
  menuPriceStatus: "current-public-menu-partial-prices",
});
replaceById(season2, "jhmp-s2-directory-088", {
  ...researchedPatch({
    name: "일직식당",
    address: "경북 안동시 관광단지로 346-29",
    region: "경북 안동시",
    phone: "054-859-6012",
    menus: [
      menu("안동간고등어구이정식", 17000, "secondary-menu-iljik", true),
      menu("안동간고등어 조림정식", 19000, "secondary-menu-iljik"),
    ],
    sourceLabel: "일직식당 현재 공개 메뉴",
    sourceUrl: "https://www.tel-co.net/food/spot/7274",
    notes: "관광단지 이전 지점의 현재 공개 메뉴판에서 구이정식과 조림정식 가격을 확인",
  }),
  menuPriceStatus: "current-public-full-menu",
});
replaceById(season2, "jhmp-s2-directory-134", researchedPatch({
  name: "반냇골옻닭전문",
  address: "전남 구례군 문척면 중산로 522-3",
  region: "전남 구례군",
  phone: "061-781-5581",
  menus: [
    menu("토종닭구이", 70000, "kakao-place-menu", true),
    menu("옻닭백숙", 65000, "kakao-place-menu"),
  ],
  sourceLabel: "카카오맵 전체 메뉴판",
  sourceUrl: "https://place.map.kakao.com/21534432",
  notes: "방송 설명과 지도 좌표가 가리키는 구례 토종닭 식당으로 상호·주소를 복원하고 공개 메뉴판 전체 반영",
}));
replaceById(season2, "jhmp-s2-directory-139", researchedPatch({
  name: "고창집",
  address: "서울 용산구 소월로20길 32 1층",
  region: "서울 용산구",
  phone: "02-754-0820",
  menus: [
    ...[
      ["두루치기", 15000], ["돼지김치찌개", 10000], ["돼지삼겹살", 22000], ["제육볶음", 15000],
      ["오리주물럭", 20000], ["두부김치", 8000], ["곤이알탕", 13000], ["동태탕", 13000],
      ["오징어볶음", 8000], ["조기매운탕", 12000], ["생굴", 10000], ["닭발볶음", 13000],
      ["한우", 25000], ["오뎅탕", 8000], ["홍어찜", 15000], ["홍어애탕", 18000],
      ["홍어회", 13000], ["닭똥집", 10000], ["과메기", 25000], ["낙지볶음", 13000],
      ["꼬막", 12000], ["닭도리탕", 13000], ["쭈꾸미볶음", 13000], ["홍어애", 10000],
      ["조기튀김", 12000], ["전어무침", 15000],
    ].map(([name, price], index) => menu(name, price, "kakao-place-menu", index === 0)),
  ],
  sourceLabel: "카카오맵 전체 메뉴판",
  sourceUrl: "https://place.map.kakao.com/15483009",
  notes: "방송 설명과 지도 좌표가 가리키는 해방촌 두루치기 식당으로 상호·주소를 복원하고 공개 메뉴판 26개 전체 반영",
}));
replaceById(season2, "jhmp-s2-directory-145", researchedPatch({
  name: "대금식당",
  address: "제주 제주시 한림읍 옹포1길 6",
  region: "제주 제주시",
  phone: "0507-1403-7751",
  menus: [
    menu("갈치조림(2인)", 37000, "secondary-menu-daegeum", true),
    menu("옥돔구이", 20000, "secondary-menu-daegeum"),
    menu("고등어구이", 15000, "secondary-menu-daegeum"),
  ],
  sourceLabel: "대금식당 현재 공개 전체 메뉴",
  sourceUrl: "https://keriai.com/648",
  notes: "방송용 가칭 '제주 갈치'를 실제 상호로 교정하고 공개 메뉴판 전체 반영",
}));
replaceById(season2, "jhmp-s2-directory-146", researchedPatch({
  name: "정성듬뿍제주국",
  address: "제주 제주시 무근성7길 16 1층",
  region: "제주 제주시",
  phone: "064-755-9388",
  menus: [
    menu("장대국", 11000, "current-menu-jejuguk"), menu("멜국", 11000, "current-menu-jejuguk"),
    menu("각재기국", 11000, "current-menu-jejuguk", true), menu("몸국", 11000, "current-menu-jejuguk"),
    menu("된장뚝배기", 11000, "current-menu-jejuguk"), menu("갈치국", 14000, "current-menu-jejuguk"),
    menu("멜튀김(반)", 11000, "current-menu-jejuguk"), menu("멜튀김", 22000, "current-menu-jejuguk"),
    menu("멜회무침", 22000, "current-menu-jejuguk"),
  ],
  sourceLabel: "정성듬뿍제주국 현재 공개 전체 메뉴",
  sourceUrl: "https://www.diningcode.com/profile.php?rid=R6DEckemtusl",
  notes: "방송용 가칭 '제주 각재기'를 실제 상호·주소로 교정하고 현재 공개 메뉴판 9개 전체 반영",
}));
markUnavailablePrices(season2);
await writeFile(seasonPath(2), `${JSON.stringify(season2, null, 2)}\n`, "utf8");

const season3 = JSON.parse(await readFile(seasonPath(3), "utf8"));
replaceById(season3, "jeonhyunmoo-plan-s3-no214", researchedPatch({
  name: "영준네",
  address: "충남 보령시 남포면 남포방조제로 408-32",
  region: "충남 보령시",
  phone: "010-4423-6237",
  menus: [
    menu("바지락칼국수", 12000, "current-menu-yeongjun", true),
    menu("우럭", 60000, "current-menu-yeongjun"),
    menu("스페셜한상차림 2인", 80000, "current-menu-yeongjun"),
    menu("스페셜한상차림 4인", 150000, "current-menu-yeongjun"),
    menu("모듬회 4인", 180000, "current-menu-yeongjun"),
  ],
  sourceLabel: "영준네 현재 공개 주문 메뉴",
  sourceUrl: "https://www.tel-co.net/food/spot/11947",
  notes: "상차림 구성 음식을 개별 메뉴로 센 기존 26개 항목을 실제 주문 가능한 현재 메뉴 5개로 정리",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no217", {
  ...researchedPatch({
    name: "소구레 소갈비",
    address: "충남 아산시 도고면 기곡로62번길 22-7",
    region: "충남 아산시",
    phone: "041-534-2442",
    menus: [menu("한우 오마카세 1인", 100000, "current-menu-sogure", true)],
    sourceLabel: "소구레 소갈비 2026년 현재 코스·가격",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=5jTdsQOAk1L1",
    notes: "갈비탕·육사시미·구이·도가니탕이 각각 별도 판매 메뉴가 아니라 하나의 예약제 코스 구성임을 확인",
  }),
  menuPriceStatus: "verified-current-single-course",
});
replaceById(season3, "jeonhyunmoo-plan-s3-no232", researchedPatch({
  name: "충남순대",
  address: "세종 금남면 용포로 97-11",
  region: "세종 금남면",
  phone: "044-862-0355",
  menus: [
    menu("순대국밥", 10000, "current-menu-chungnam-sundae", true),
    menu("순대국밥 특", 11000, "current-menu-chungnam-sundae"),
    menu("짬뽕순대국밥", 11000, "current-menu-chungnam-sundae"),
    menu("모둠순대 소", 11000, "current-menu-chungnam-sundae"),
    menu("모둠순대 대", 16000, "current-menu-chungnam-sundae"),
    menu("뼈다귀해장국", 11000, "current-menu-chungnam-sundae"),
  ],
  sourceLabel: "충남순대 2025년 12월 전체 메뉴",
  sourceUrl: "https://keriai.com/1323",
  notes: "순대국밥·모둠순대의 사이즈별 가격까지 분리해 반영",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no246", researchedPatch({
  name: "진선(갱조개)",
  address: "전남 광양시 진월면 선소중앙길 43",
  region: "전남 광양시",
  phone: "061-772-0750",
  menus: [
    menu("재첩회 대", 50000, "current-menu-jinseon", true),
    menu("재첩회 중", 40000, "current-menu-jinseon"),
    menu("재첩회 소", 30000, "current-menu-jinseon"),
    menu("재첩회·식사", 22000, "current-menu-jinseon"),
    menu("정식", 13000, "current-menu-jinseon"),
    menu("재첩국 팩", 8000, "current-menu-jinseon"),
  ],
  sourceLabel: "진선 현재 전체 메뉴",
  sourceUrl: "https://youtubeplace.co.kr/restaurant/detail/jinsun-gangjogae-gwangyang-korean",
  notes: "재첩회 사이즈별 가격과 정식·포장 재첩국까지 현재 공개 메뉴 6개 전체 반영",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no261", {
  ...researchedPatch({
    name: "부원곱창(부원제비추리)",
    address: "강원 춘천시 김유정로 1852-5",
    region: "강원 춘천시",
    phone: "033-264-4656",
    menus: [
      menu("곱창구이 200g", 22000, "current-menu-buwon-gopchang"),
      menu("내장전골 대", 55000, "current-menu-buwon-gopchang"),
      menu("내장전골 중", 45000, "current-menu-buwon-gopchang"),
      menu("내장전골 소", 35000, "current-menu-buwon-gopchang"),
      menu("내장탕", 11000, "current-menu-buwon-gopchang"),
      menu("육사시미", 40000, "current-menu-buwon-gopchang"),
      menu("육회", 40000, "current-menu-buwon-gopchang"),
      menu("제비추리 200g", 38000, "current-menu-buwon-gopchang", true),
      menu("간 200g", 15000, "current-menu-buwon-gopchang"),
      menu("천엽 200g", 15000, "current-menu-buwon-gopchang"),
      menu("지라 200g", 15000, "current-menu-buwon-gopchang"),
      menu("염통구이 200g", 15000, "current-menu-buwon-gopchang"),
      menu("된장찌개", 3000, "current-menu-buwon-gopchang"),
      menu("볶음밥", 3000, "current-menu-buwon-gopchang"),
      menu("공기밥", 1000, "current-menu-buwon-gopchang"),
    ],
    sourceLabel: "부원곱창 현재 전체 메뉴판",
    sourceUrl: "https://polle.com/place/1ssIzv/%EB%B6%80%EC%9B%90%EA%B3%B1%EC%B0%BD",
    notes: "방송용 표기 부원제비추리를 실제 영업 상호 부원곱창과 연결하고 고기·전골·식사 메뉴 15개 전체 가격을 반영",
  }),
  aliases: ["부원제비추리", "부원곱창"],
  kakaoPlaceId: "22424866",
  placeUrl: "https://place.map.kakao.com/22424866",
  matchedPlaceName: "부원곱창",
  lat: 37.85224122,
  lng: 127.73484416,
});
replaceById(season3, "jeonhyunmoo-plan-s3-no227", researchedPatch({
  name: "부원면옥",
  address: "서울 중구 남대문시장4길 41-6 부원상가 2층",
  region: "서울 중구",
  phone: "02-753-7728",
  menus: [
    menu("물냉면", 11500, "secondary-menu-buwon", true),
    menu("비빔냉면", 12000, "secondary-menu-buwon"),
    menu("제육무침", 16000, "secondary-menu-buwon"),
    menu("닭무침", 16000, "secondary-menu-buwon"),
    menu("빈대떡", 6000, "secondary-menu-buwon"),
    menu("온면", 12000, "secondary-menu-buwon"),
  ],
  sourceLabel: "부원면옥 2026 공개 메뉴판",
  sourceUrl: "https://prolivingtips.com/jeon-hyun-moo-plan-season-3-8th-namdaemun-pyongyang-cold-noodles/",
  notes: "오수집된 인터넷신문 등록번호 주소를 실제 식당 주소로 교정하고 2026 공개 메뉴·가격 반영",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no229", researchedPatch({
  name: "옛날원대막국수",
  address: "강원 인제군 인제읍 자작나무숲길 1113",
  region: "강원 인제군",
  phone: "033-462-1515",
  menus: [
    menu("막국수(물·비빔)", 10000, "secondary-menu-wondae", true),
    menu("곱배기", 14000, "secondary-menu-wondae"),
    menu("주류", 5000, "secondary-menu-wondae"),
    menu("사리", 5000, "secondary-menu-wondae"),
    menu("햇들깨감자옹심이(찰밥 포함·계절메뉴)", 12000, "secondary-menu-wondae"),
    menu("묵밥(찰밥 포함)", 10000, "secondary-menu-wondae"),
    menu("감자전 2장", 15000, "secondary-menu-wondae"),
    menu("곰취수육 소(1~2인)", 17000, "secondary-menu-wondae"),
    menu("곰취수육 중(3~4인)", 29000, "secondary-menu-wondae"),
    menu("도토리묵무침 큰 사이즈", 20000, "secondary-menu-wondae"),
    menu("도토리묵무침 작은 사이즈", 10000, "secondary-menu-wondae"),
    menu("메밀전병", 9000, "secondary-menu-wondae"),
    menu("음료수", 2000, "secondary-menu-wondae"),
  ],
  sourceLabel: "옛날원대막국수 최신 공개 메뉴판",
  sourceUrl: "https://www.diningcode.com/profile.php?rid=0rGqLZwq25lS",
  notes: "오수집된 인터넷신문 등록번호 주소를 실제 식당 주소로 교정하고 최신 공개 메뉴·가격 반영",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no250", {
  ...researchedPatch({
    name: "백년지기삼계탕 평촌점",
    address: "경기 안양시 동안구 갈산로44번길 44",
    region: "경기 안양시",
    phone: "031-452-9977",
    menus: [
      menu("삼계탕", 17000, "current-menu-baeknyeon", true),
      menu("닭볶음탕(예약 필수)", 40000, "current-menu-baeknyeon"),
      menu("닭모래집볶음", 12000, "current-menu-baeknyeon"),
      menu("맥주", 5000, "current-menu-baeknyeon"),
      menu("소주", 5000, "current-menu-baeknyeon"),
    ],
    sourceLabel: "백년지기삼계탕 2026년 현재 전체 메뉴",
    sourceUrl: "https://www.tel-co.net/food/spot/12609",
    notes: "2026년 현재 공개 메뉴판 5개를 반영하고 과거 지도에 남은 백숙·닭도리탕 중복 표기는 제외",
  }),
  menuPriceStatus: "current-public-full-menu",
});
replaceById(season3, "jeonhyunmoo-plan-s3-no262", researchedPatch({
  name: "한라식당 제주본점",
  address: "제주 제주시 광양9길 19",
  region: "제주 제주시",
  phone: "064-758-8301",
  menus: [
    ...[
      ["갈치조림 4인세트", 78000], ["갈치조림 3인세트", 65000],
      ["갈치조림 2인(공기밥 포함)+국 1종", 49000], ["옥돔뭇국", 17000],
      ["갈치국", 17000], ["갈치조림 1인(2인 이상 주문)", 16000],
      ["제주식 돼지고기 산적", 15000], ["성게미역국", 17000],
      ["갈치구이", 30000], ["생옥돔구이 2마리", 30000], ["고등어구이", 15000],
      ["자리물회", 17000], ["한치물회", 17000], ["소주", 5000], ["맥주", 5000],
      ["막걸리", 4000], ["음료수", 2000], ["공기밥", 1000],
    ].map(([name, price], index) => menu(name, price, "current-menu-halla", index === 3)),
  ],
  sourceLabel: "한라식당 제주본점 현재 전체 메뉴",
  sourceUrl: "https://polle.com/place/3jTs5u/%ED%95%9C%EB%9D%BC%EC%8B%9D%EB%8B%B9",
  notes: "국·구이뿐 아니라 세트·물회·주류·추가 메뉴까지 현재 공개 메뉴판 18개 전체 반영",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no275", researchedPatch({
  name: "대추나무집",
  address: "충북 청주시 상당구 상당로 40-12",
  region: "충북 청주시",
  phone: "043-256-2322",
  menus: [
    menu("닭볶음탕(밥 별도)", 60000, "current-menu-daechu", true),
    menu("닭백숙(찰밥 포함)", 65000, "current-menu-daechu"),
    menu("오리백숙(찰밥 포함)", 65000, "current-menu-daechu"),
    menu("삼계탕(4마리 이상 주문 가능)", 17000, "current-menu-daechu"),
    menu("삼겹살 180g", 14000, "current-menu-daechu"),
  ],
  sourceLabel: "대추나무집 2026년 현재 전체 메뉴",
  sourceUrl: "https://www.tabling.co.kr/place/677ccae066de5f06987c28ed",
  notes: "카카오의 가격 없는 음식명 18개를 현재 공개 메뉴판 5개로 교체",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no282", researchedPatch({
  name: "중앙참치",
  address: "서울 영등포구 영등포로43길 14 1층",
  region: "서울 영등포구",
  phone: "02-2634-3681",
  menus: [
    menu("실장스페셜", 40000, "current-menu-jungang-tuna"),
    menu("특실장스페셜", 50000, "current-menu-jungang-tuna", true),
    menu("중참스페셜", 60000, "current-menu-jungang-tuna"),
  ],
  sourceLabel: "중앙참치 2026년 현재 전체 코스",
  sourceUrl: "https://cooinglog.tistory.com/entry/%EC%A0%84%ED%98%84%EB%AC%B4%EA%B3%84%ED%9A%8D3-%EC%98%81%EB%93%B1%ED%8F%AC-%EC%B0%B8%EC%B9%98%ED%9A%8C-%EC%BD%94%EC%8A%A4-%EB%A7%9B%EC%A7%91-%EC%A4%91%EC%95%99%EC%B0%B8%EC%B9%98-%EC%9C%84%EC%B9%98-%EC%A0%95%EB%B3%B4",
  notes: "현재 운영 중인 무한리필 코스 3종과 가격을 반영",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no286", {
  ...researchedPatch({
    name: "대흥식육점&우가네",
    address: "경북 문경시 문경읍 새재로 458-9 (대흥식육점)",
    region: "경북 문경시",
    phone: "054-571-1170",
    menus: [
      foreignMenu("약돌돼지 삼겹살·목살 100g", "3,834원(2026년 4월 방문가·시가 변동)", "current-menu-daeheung", true),
      foreignMenu("한우 등심·채끝 100g", "14,500원(2026년 4월 방문가·시가 변동)", "current-menu-daeheung"),
      menu("우가네 상차림 2인", 20000, "current-menu-daeheung"),
      menu("우가네 상차림 3인부터 1인 추가", 7000, "current-menu-daeheung"),
      menu("우가네 매장 삼겹살 100g", 9000, "current-menu-daeheung"),
    ],
    sourceLabel: "대흥식육점·우가네 2026년 공개 가격",
    sourceUrl: "https://www.diningcode.com/profile.php?rid=Q0cIswTC74iA",
    notes: "식육점 고기는 중량·시세에 따라 변동하므로 조사 시점 방문가와 상차림 고정가를 구분해 저장",
  }),
  menuPriceStatus: "market-price-with-current-observed-prices",
});
replaceById(season3, "jeonhyunmoo-plan-s3-no289", researchedPatch({
  name: "우리집식당",
  address: "강원 삼척시 중앙로 14-41",
  region: "강원 삼척시",
  phone: "0507-1332-4410",
  menus: [
    menu("가정식백반", 9000, "current-menu-ourhouse", true),
    menu("생선매운탕 소", 30000, "current-menu-ourhouse"),
    menu("생선매운탕 중", 40000, "current-menu-ourhouse"),
    menu("생선매운탕 대", 50000, "current-menu-ourhouse"),
    foreignMenu("상차림비", "5,000원부터(요리 추가 시 각 5,000원)", "current-menu-ourhouse"),
  ],
  sourceLabel: "우리집식당 2026년 현재 전체 메뉴",
  sourceUrl: "https://keriai.com/1587",
  notes: "방송에서 시장 재료로 조리한 생선 요리는 고정 판매 메뉴가 아니므로 실제 식당 메뉴와 상차림 가격으로 정리",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no292", researchedPatch({
  name: "금학칼국수",
  address: "강원 강릉시 대학길 12-6",
  region: "강원 강릉시",
  phone: "033-646-0175",
  menus: [
    menu("장칼국수", 8000, "current-menu-geumhak", true),
    menu("콩나물밥", 8000, "current-menu-geumhak"),
  ],
  sourceLabel: "금학칼국수 2026년 현재 전체 메뉴",
  sourceUrl: "https://keriai.com/1601",
  notes: "실제 선택 메뉴가 2개뿐인 노포로 확인해 두 메뉴 가격을 모두 반영",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no293", {
  ...researchedPatch({
    name: "해성집(해성횟집)",
    address: "강원 강릉시 금성로 21 중앙시장 2층",
    region: "강원 강릉시",
    phone: "033-648-4313",
    menus: [
      menu("삼숙이탕", 15000, "current-menu-haeseong", true),
      menu("알탕", 15000, "current-menu-haeseong"),
    ],
    sourceLabel: "해성집 2026년 현재 전체 메뉴",
    sourceUrl: "https://keriai.com/1602",
    notes: "현재 회는 판매하지 않고 삼숙이탕·알탕 두 메뉴만 운영함을 확인",
  }),
  menuPriceStatus: "verified-current-two-menu-restaurant",
});
replaceById(season3, "jeonhyunmoo-plan-s3-no295", researchedPatch({
  name: "시장국밥",
  address: "광주 광산구 내상로 56-7",
  region: "광주 광산구",
  phone: "0507-1394-0958",
  menus: [
    ...[
      ["시장국밥", 9000], ["살코기국밥", 11000], ["머릿고기", 20000], ["시장국수", 9000],
      ["순대국밥", 9000], ["콩나물국밥", 8000], ["새끼보국밥", 11000], ["머리국밥", 9000],
      ["내장국밥", 9000], ["술국", 9000], ["특국밥", 11000], ["선지국밥", 9000],
      ["암뽕국밥", 11000], ["따로국밥", 10000], ["모둠국밥", 13000], ["살코기 수육", 23000],
      ["돈설 수육", 21000], ["암뽕순대", 20000], ["새끼보", 23000], ["모듬안주", 45000],
    ].map(([name, price], index) => menu(name, price, "current-menu-market-gukbap", index === 0)),
  ],
  sourceLabel: "시장국밥 현재 전체 메뉴",
  sourceUrl: "https://polle.com/place/42EChf/%EC%8B%9C%EC%9E%A5%EA%B5%AD%EB%B0%A5",
  notes: "대표 2개만 있던 원본을 현재 공개 메뉴판 20개 전체로 교체",
}));
replaceById(season3, "jeonhyunmoo-plan-s3-no299", {
  ...researchedPatch({
    name: "성내장어셀프",
    address: "전북 고창군 성내면 선운대로 4223-6",
    region: "전북 고창군",
    phone: "063-562-5898",
    menus: [
      foreignMenu("홀 식사 민물장어 셀프구이 1kg", "73,000원(방문 시점·산지 시세 변동)", "current-menu-seongnae", true),
      foreignMenu("장어 추가 1마리", "24,500원(방문 시점·산지 시세 변동)", "current-menu-seongnae"),
      foreignMenu("초벌구이 포장 1kg", "45,000원(방문 시점 특가·변동 가능)", "current-menu-seongnae"),
      foreignMenu("생장어 포장 1kg(3마리)", "40,000원(방문 시점·변동 가능)", "current-menu-seongnae"),
      menu("컵라면", 2000, "current-menu-seongnae"),
      menu("공기밥", 1000, "current-menu-seongnae"),
    ],
    sourceLabel: "성내장어셀프 2026년 공개 메뉴·시세",
    sourceUrl: "https://i2m.haedory.com/2026/05/jeonhyunmooplan3-gochang-pungchunjangeo.html",
    notes: "장어는 산지 시세 변동 메뉴이므로 방문 시점 가격임을 명시하고 홀·추가·포장 가격을 각각 저장",
  }),
  menuPriceStatus: "market-price-with-current-observed-prices",
});
markUnavailablePrices(season3);
await writeFile(seasonPath(3), `${JSON.stringify(season3, null, 2)}\n`, "utf8");

console.log("Applied researched menu and address overrides.");
