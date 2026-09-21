import { isServiceFee, matchAuditIdentity } from './operation-audit.mjs';

// Store unresolved evidence as review notes; only matched menu snapshots become prices.
export function buildPriceFollowupPatch(row) {
  const accepted = row.mapEvidence.filter(e => matchAuditIdentity(row, e.place).accepted);
  const menuSources = new Map(accepted.map(e => [e.sourceUrl, e]));
  const menus = row.menus.filter(m => m.name?.trim() && !isServiceFee(m));
  const hasPriceSnapshot = menus.some(m => m.price) && menus.every(m => menuSources.has(m.sourceUrl));
  const sources = hasPriceSnapshot
    ? [...new Set(menus.map(m => m.sourceUrl))].map(url => ({
        label: '카카오지도 공개 메뉴 · 동일 상호·주소 대조', url,
        ...(menuSources.get(url).menuUpdatedAt ? { publishedAt: menuSources.get(url).menuUpdatedAt.slice(0, 10) } : {}),
      }))
    : row.status === 'delivery_price_only'
      ? accepted.map(e => ({ label: '배달 가격 자료 · 매장 가격 미확인', url: e.sourceUrl }))
      : row.sources.map(s => ({ label: `가격 검토 후보 · ${s.title || '공개 안내'}`, url: s.url }));
  const patch = {
    menuPriceStatus: hasPriceSnapshot ? 'public-menu-snapshot' : row.status,
    menuPriceNote: hasPriceSnapshot
      ? '동일 지점의 공개 메뉴를 수집한 날짜이며 현재 매장 가격을 보증하지 않습니다. 자료 기준일은 출처별로 다릅니다.'
      : `[가격 검토 중 · ${row.checkedAt.slice(0, 10)}] ${row.reason}`,
  };
  if (hasPriceSnapshot) {
    patch.menuPriceSources = sources.filter(s => /^https:\/\//.test(s.url)).slice(0, 10);
    patch.menus = menus.map(({ id, name, price, isSignature }) => ({ id, name, ...(price ? { price } : {}), isSignature: Boolean(isSignature) }));
    patch.menuPriceVerifiedAt = row.checkedAt.slice(0, 10);
  }
  return patch;
}
