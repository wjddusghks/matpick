import crypto from "node:crypto";

export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = "",
    quoted = false;
  const value = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < value.length; i++) {
    const c = value[i];
    if (c === '"') {
      if (quoted && value[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(field);
      field = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && value[i + 1] === "\n") i++;
      row.push(field);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (quoted) throw new Error("Unclosed CSV field");
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  const headers = rows.shift() || [];
  return rows.map((cells, i) => {
    if (cells.length !== headers.length)
      throw new Error(`CSV row ${i + 2}: wrong column count`);
    return Object.fromEntries(
      headers.map((header, j) => [header, cells[j].trim()]),
    );
  });
}
export const plain = (value) =>
  String(value || "")
    .replace(/<br\s*\/?\s*>/gi, " / ")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
const hash = (value) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);

export function normalizeTourismRecord(feed, row, index, retrievedAt) {
  let nativeId,
    name,
    address,
    lat,
    lng,
    representativeMenu,
    phone,
    sourceUpdatedAt;
  if (feed === "busan") {
    nativeId = String(row.UC_SEQ || "");
    name = plain(row.MAIN_TITLE || row.PLACE);
    address = plain(`${row.ADDR1 || ""} ${row.ADDR2 || ""}`);
    if (address && !/^부산/.test(address)) address = `부산 ${address}`;
    lat = Number(row.LAT);
    lng = Number(row.LNG);
    representativeMenu = plain(row.RPRSNTV_MENU);
    phone = plain(row.CNTCT_TEL);
  } else if (feed === "tourapi") {
    if (String(row.contenttypeid) !== "39") return null;
    nativeId = String(row.contentid || "");
    name = plain(row.title);
    address = plain(`${row.addr1 || ""} ${row.addr2 || ""}`);
    lat = Number(row.mapy);
    lng = Number(row.mapx);
    representativeMenu = plain(row.firstmenu || row.treatmenu);
    phone = plain(row.infocenterfood || row.tel);
    sourceUpdatedAt = row.modifiedtime;
  } else if (feed === "visit-jeju") {
    name = plain(row["콘텐츠명"]);
    nativeId = `${hash(name)}-row-${index + 2}`;
    address = "";
    lat = null;
    lng = null;
    representativeMenu = plain(row["대표메뉴기타"]);
    phone = "";
  } else throw new Error(`Unknown source: ${feed}`);
  const issues = [];
  if (!nativeId || !name || /^(업체등록확인|테스트|test)$/i.test(name))
    issues.push("invalid_identity");
  if (!address) issues.push("address_missing");
  if (
    !(
      Number.isFinite(lat) &&
      lat >= 33 &&
      lat <= 39 &&
      Number.isFinite(lng) &&
      lng >= 124 &&
      lng <= 132
    )
  )
    issues.push("coordinates_missing_or_invalid");
  if (!representativeMenu) issues.push("menu_missing");
  return {
    candidateId: `${feed}:${nativeId}`,
    nativeId,
    feed,
    name,
    address,
    lat,
    lng,
    representativeMenu,
    phone,
    ...(sourceUpdatedAt ? { sourceUpdatedAt } : {}),
    retrievedAt,
    issues,
    reviewStatus: "pending",
    ...(feed === "visit-jeju" ? { sourceFields: row } : {}),
  };
}

export function validateApprovedCandidate(candidate) {
  if (candidate.reviewStatus !== "approved")
    throw new Error(`${candidate.candidateId}: not approved`);
  if (!candidate.name || !candidate.address || !candidate.nativeId)
    throw new Error("Restaurant identity is required");
  if (
    !(
      candidate.lat >= 33 &&
      candidate.lat <= 39 &&
      candidate.lng >= 124 &&
      candidate.lng <= 132
    )
  )
    throw new Error("Valid Korean coordinates are required");
  if (
    !candidate.verification?.checkedAt ||
    !/^https:\/\//.test(candidate.verification?.sourceUrl || "")
  )
    throw new Error("Branch verification date and source URL are required");
  if (candidate.operationState !== "operating")
    throw new Error("Operating status must be reviewed before publication");
}
