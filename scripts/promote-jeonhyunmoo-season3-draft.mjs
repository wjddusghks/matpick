import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sourceRoot = path.resolve(__dirname, "..", "source-data", "jeonhyunmoo-plan");
const detailPath = path.join(sourceRoot, "official-detail-drafts.json");
const indexPath = path.join(sourceRoot, "official-page-index.json");
const outputDir = path.join(sourceRoot, "season-3");

const corrections = new Map([
  [
    214,
    {
      address: "충남 보령시 남포면 남포방조제로 408-32",
      phone: "010-4423-6237",
      secondarySourceUrl: "https://nun777.tistory.com/1389?category=169185",
    },
  ],
  [
    219,
    {
      address: "경북 상주시 함창읍 함창중앙로 100-6",
      phone: "054-541-0437",
      secondarySourceUrl: "https://opengo.kr/5601fb7b0e887edf2cf31863",
    },
  ],
  [
    220,
    {
      address: "경북 상주시 남적로 6-75",
      phone: "054-532-6966",
      secondarySourceUrl: "https://www.koobig.com/75678",
    },
  ],
  [
    262,
    {
      address: "제주 제주시 광양9길 19",
      phone: "064-758-8301",
      representativeMenu: "옥돔뭇국",
      menus: ["옥돔뭇국", "생옥돔구이"],
      secondarySourceUrl:
        "https://www.tripinfo.co.kr/info.html?content_id=655015&content_type_id=39",
    },
  ],
  [
    273,
    {
      representativeMenu: "새뱅이찌개",
      menus: ["새뱅이찌개"],
      secondarySourceUrl: "https://keriai.com/1493",
    },
  ],
]);

function normalize(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function buildRegion(address) {
  const tokens = normalize(address).split(" ").filter(Boolean);
  return tokens.slice(0, 2).join(" ");
}

async function readJson(filePath) {
  return JSON.parse((await readFile(filePath, "utf8")).replace(/^\uFEFF/, ""));
}

async function main() {
  const drafts = (await readJson(detailPath)).filter((record) => record.season === 3);
  const pageIndex = (await readJson(indexPath)).filter((entry) => entry.program === "전현무계획3");

  const restaurants = drafts.map((draft) => {
    const correction = corrections.get(draft.restaurantRecordNo) ?? {};
    const address = normalize(correction.address ?? draft.address);
    const phone = normalize(correction.phone ?? draft.phone);
    const menuNames = (correction.menus ?? draft.menus ?? [])
      .map(normalize)
      .filter(Boolean);
    const representativeMenu = normalize(
      correction.representativeMenu ?? draft.representativeMenu ?? menuNames[0]
    );
    const sourceId = `mbn-s3-e${draft.episode}-${new URL(draft.sourceUrl).pathname.split("/")[2]}`;
    const hasSecondaryCorrection = Boolean(correction.secondarySourceUrl);

    return {
      id: draft.id,
      season: 3,
      episode: draft.episode,
      restaurantRecordNo: draft.restaurantRecordNo,
      name: normalize(draft.name),
      aliases: [],
      region: buildRegion(address),
      address,
      phone,
      category: representativeMenu || "음식점",
      representativeMenu,
      menus: menuNames.map((name, index) => ({
        name,
        price: null,
        isSignature: index === 0,
        sourceId,
        observedAt: "2026-07-15",
        confidence: hasSecondaryCorrection ? 0.9 : 1,
      })),
      broadcastDate: draft.broadcastDate,
      sourceUrl: draft.sourceUrl,
      secondarySourceUrl: correction.secondarySourceUrl ?? null,
      evidenceText: hasSecondaryCorrection
        ? "MBN 공식 맛집기록의 방송 정보와 보조 공개 출처의 주소·연락처를 교차 확인함."
        : "MBN 공식 맛집기록에서 상호, 메뉴, 주소, 전화번호를 확인함.",
      lat: null,
      lng: null,
      confidence: hasSecondaryCorrection ? 0.9 : 1,
      reviewStatus: hasSecondaryCorrection ? "secondary-verified" : "source-verified",
      notes: "",
    };
  });

  const sources = pageIndex.map((entry) => ({
    id: `mbn-s3-e${Number(entry.title.match(/(\d+)회/)?.[1] ?? 0)}-${entry.castId}`,
    title: entry.title,
    publisher: "MBN",
    url: entry.url,
    publishedAt: entry.date,
    capturedAt: "2026-07-15",
    sourceType: "official_broadcast_info",
  }));

  const numbers = restaurants.map((restaurant) => restaurant.restaurantRecordNo);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const numberSet = new Set(numbers);
  const gaps = Array.from({ length: max - min + 1 }, (_, index) => min + index).filter(
    (number) => !numberSet.has(number)
  );
  const secondaryCount = restaurants.filter(
    (restaurant) => restaurant.reviewStatus === "secondary-verified"
  ).length;

  const report = `# 전현무계획3 수집 보고서

- 기준일: 2026-07-15
- 수집 범위: EP.1~36
- 공식 방송정보 페이지: ${sources.length}개(EP.1 분할 게시물 포함)
- 수집 출연 건: ${restaurants.length}건
- 공식 맛집기록 범위: No.${min}~${max}
- 공식 번호 공백: ${gaps.join(", ")}
- MBN 단독 확인: ${restaurants.length - secondaryCount}건
- 공식 페이지의 누락 필드를 보조 공개 출처로 보완: ${secondaryCount}건
- 가격 확인: 공식 방송정보에 없는 값은 모두 null
- 좌표 확인: 0/${restaurants.length}(후속 지오코딩 필요)

## 검증 메모

- 공식 번호 공백은 임의 식당을 넣지 않고 원문 상태로 보존했습니다.
- No.214, 219, 220, 262, 273은 공식 페이지의 주소·전화·메뉴 일부가 누락되어 보조 공개 출처를 연결했습니다.
- 방송사 이미지와 긴 소개문은 저장하지 않았습니다.
`;

  await mkdir(outputDir, { recursive: true });
  await writeFile(
    path.join(outputDir, "source.json"),
    `${JSON.stringify(
      {
        id: "jeonhyunmoo-plan-season-3",
        name: "전현무계획3",
        type: "tv_show",
        provider: "MBN",
        seriesId: "jeonhyunmoo-plan",
        season: 3,
        capturedAt: "2026-07-15",
        status: "completed",
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  await writeFile(path.join(outputDir, "restaurants.json"), `${JSON.stringify(restaurants, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "sources.json"), `${JSON.stringify(sources, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "evidence-report.md"), report, "utf8");

  console.log(`promoted ${restaurants.length} season 3 records`);
  console.log(`secondary-verified: ${secondaryCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
