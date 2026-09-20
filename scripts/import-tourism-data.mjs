import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeTourismRecord, parseCsv } from "./tourism-data.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => args[args.indexOf(name) + 1];
const feed = option("--source");
if (!["busan", "visit-jeju", "tourapi"].includes(feed))
  throw new Error(
    "Use --source busan|visit-jeju|tourapi [--file input.json|input.csv] [--region 26|50]",
  );
const retrievedAt = new Date().toISOString();
let rows = [];
const toArray = (value) =>
  Array.isArray(value) ? value : value ? [value] : [];
async function request(endpoint, parameters) {
  const url = new URL(endpoint);
  Object.entries(parameters).forEach(([key, value]) =>
    url.searchParams.set(key, String(value)),
  );
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok)
    throw new Error(`Official feed returned HTTP ${response.status}`);
  // Do not log URLs or response bodies: gateways can echo the service key.
  try {
    return await response.json();
  } catch {
    throw new Error(
      "Official feed returned a non-JSON response. Check key approval and quota.",
    );
  }
}
function unpack(payload) {
  if (feed === "busan") {
    const body = payload.getFoodKr;
    if (
      !body ||
      !["00", "0"].includes(
        String(body.header?.code ?? body.header?.resultCode ?? "00"),
      )
    )
      throw new Error("Busan feed authorization or response error");
    return { rows: toArray(body.item), total: Number(body.totalCount) };
  }
  const response = payload.response;
  if (
    !response ||
    !["0000", "00"].includes(String(response.header?.resultCode))
  )
    throw new Error("TourAPI authorization or response error");
  return {
    rows: toArray(response.body?.items?.item),
    total: Number(response.body?.totalCount),
  };
}
if (args.includes("--file")) {
  const bytes = await fs.readFile(path.resolve(option("--file")));
  if (feed === "visit-jeju") {
    let text = new TextDecoder("utf-8").decode(bytes);
    if (text.includes("\uFFFD")) text = new TextDecoder("euc-kr").decode(bytes);
    rows = parseCsv(text);
  } else {
    const payload = JSON.parse(bytes.toString("utf8"));
    rows = Array.isArray(payload) ? payload : unpack(payload).rows;
  }
} else {
  if (feed === "visit-jeju")
    throw new Error(
      "Download the public Visit Jeju CSV and pass --file. No key is required.",
    );
  const suppliedKey =
    process.env[
      feed === "busan" ? "BUSAN_DATA_SERVICE_KEY" : "TOUR_API_SERVICE_KEY"
    ] || process.env.DATA_GO_KR_SERVICE_KEY;
  if (!suppliedKey)
    throw new Error(
      `${feed === "busan" ? "BUSAN_DATA_SERVICE_KEY" : "TOUR_API_SERVICE_KEY"} is required. Keep keys in the local environment, never source files.`,
    );
  let serviceKey;
  try {
    serviceKey = decodeURIComponent(suppliedKey);
  } catch {
    throw new Error("Invalid encoded service key");
  }
  const region = args.includes("--region") ? option("--region") : null;
  if (region && !/^\d{2}$/.test(region))
    throw new Error(
      "--region must be a two-digit legal region code (26 Busan, 50 Jeju)",
    );
  for (let pageNo = 1; pageNo <= 1000; pageNo++) {
    const payload =
      feed === "busan"
        ? await request(
            "https://apis.data.go.kr/6260000/FoodService/getFoodKr",
            {
              ServiceKey: serviceKey,
              pageNo,
              numOfRows: 100,
              resultType: "json",
            },
          )
        : await request(
            "https://apis.data.go.kr/B551011/KorService2/areaBasedList2",
            {
              serviceKey,
              MobileOS: "WEB",
              MobileApp: "Matpick",
              _type: "json",
              contentTypeId: 39,
              pageNo,
              numOfRows: 100,
              arrange: "A",
              ...(region ? { lDongRegnCd: region } : {}),
            },
          );
    const data = unpack(payload);
    rows.push(...data.rows);
    if (!data.rows.length || rows.length >= data.total) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  if (feed === "tourapi") {
    const detailLimit = args.includes("--detail-limit") ? Number(option("--detail-limit")) : 250;
    if (!Number.isInteger(detailLimit) || detailLimit < 0 || detailLimit > 800) throw new Error("--detail-limit must be between 0 and 800; use 0 for list-only preparation.");
    for (let i = 0; i < Math.min(rows.length, detailLimit); i++) {
      const payload = await request(
        "https://apis.data.go.kr/B551011/KorService2/detailIntro2",
        {
          serviceKey,
          MobileOS: "WEB",
          MobileApp: "Matpick",
          _type: "json",
          contentTypeId: 39,
          contentId: rows[i].contentid,
        },
      );
      const detail = unpack(payload).rows[0] || {};
      rows[i] = {
        ...rows[i],
        firstmenu: detail.firstmenu,
        treatmenu: detail.treatmenu,
        infocenterfood: detail.infocenterfood,
      };
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}
const candidates = rows
  .map((row, index) => normalizeTourismRecord(feed, row, index, retrievedAt))
  .filter(Boolean);
const ids = new Set();
for (const candidate of candidates) {
  if (ids.has(candidate.candidateId))
    throw new Error(`Duplicate source ID: ${candidate.candidateId}`);
  ids.add(candidate.candidateId);
}
const output = {
  feed,
  retrievedAt,
  sourceRows: rows.length,
  candidateCount: candidates.length,
  withMenuText: candidates.filter((c) => c.representativeMenu).length,
  publishReady: 0,
  candidates,
};
const directory = path.join(root, "source-data/travel-discovery/staging");
await fs.mkdir(directory, { recursive: true });
const scope =
  feed === "tourapi" && args.includes("--region")
    ? `${feed}-${option("--region")}`
    : feed;
await fs.writeFile(
  path.join(directory, `${scope}.json`),
  JSON.stringify(output, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    feed,
    sourceRows: rows.length,
    candidates: candidates.length,
    withMenuText: output.withMenuText,
    published: 0,
  }),
);
