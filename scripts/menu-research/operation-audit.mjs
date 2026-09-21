import {addressParts, cleanRestaurantName, identityMatch, normalize} from './matching.mjs';

export const isServiceFee = m => /입장료|이용료|자리세|상차림|[셋세]팅비|콜키지/.test(m.name||'');
export const isFixedMenuPrice = m => !isServiceFee(m)&&!/시가|변동|문의/.test((m.name||'')+' '+(m.price||''))&&Number(String(m.price||'').replace(/[^\d.]/g,''))>0;

export function cleanAuditRestaurant(r) {
  let address = r.address || '';
  if (/^[가-힣]+구\s/.test(address) && /^(서울|부산|대구|인천|광주|대전|울산)/.test(r.region || '')) address = `${r.region.split(' ')[0]} ${address}`;
  const name = r.name.replace(/\([^)]*\)/g, '').replace(/현재\s*폐업|폐업|영업종료/g, '').trim();
  return {...r,address,name:cleanRestaurantName({...r,name,address})};
}

export function matchAuditIdentity(original, candidate) {
  const r = cleanAuditRestaurant(original);
  const c = {...candidate, name:candidate.name.replace(/\([^)]*\)/g,'').replace(/^주식회사\s*/, '').trim()};
  const m = identityMatch(r,c);
  const n = normalize(r.name), other = normalize(c.name);
  const tokens = r.name.split(/\s+/).map(normalize);
  const branchSuffix = /^(?:[가-힣0-9]+점|본점|본관|직영점)$/;
  // A license often omits the branch suffix. This rule still requires the same street/parcel and municipality.
  const branchName = tokens.length===2 && tokens[0]===other && branchSuffix.test(tokens[1]);
  const translatedBy = n.replace(/바이/g,'by')===other.replace(/바이/g,'by');
  const sameName = m.sameName || branchName || translatedBy;
  const floors = address => [...String(address||'').matchAll(/(지하|B)?\s*(\d+(?:\s*[,~\-]\s*\d+)*)\s*층/g)].flatMap(x=>x[2].match(/\d+/g).map(n=>Number(n)*(x[1]?-1:1)));
  const aFloors=floors(r.address), bFloors=floors(c.address);
  const floorConflict=Boolean(aFloors.length&&bFloors.length&&!aFloors.some(f=>bFloors.includes(f)));
  const unrelatedFacility=/전기차충전|주차장|전용주차|물류센터/.test(c.name+' '+(c.category||''));
  return {...m,sameName,floorConflict,unrelatedFacility,accepted:m.sameProvince&&m.sameLocality&&(m.sameRoad||m.sameParcel)&&sameName&&!floorConflict&&!unrelatedFacility};
}

export function sameAuditAddress(original,candidate){
  const r=cleanAuditRestaurant(original);
  const m=identityMatch({...r,name:candidate.name},candidate);
  return m.sameProvince&&m.sameLocality&&(m.sameRoad||m.sameParcel);
}

export function classifyOperation({restaurant, licenses=[],mapEvidence=[],alternativePlaces=[],manual}) {
  if(manual?.classification) return {status:manual.classification,reason:manual.reason};
  const active=licenses.filter(l=>/^(정상|영업(?:\/정상)?)$/.test(l.status));
  const closed=licenses.filter(l=>/^폐업/.test(l.status));
  const temporary=licenses.filter(l=>/휴업|영업정지/.test(l.status));
  const usableMap=mapEvidence.filter(e=>e.match?.accepted);
  // CLOSED means today's business hours ended. It is never a permanent closure signal.
  const mapOpen=usableMap.some(e=>e.listingStatus==='Y'&&(e.openHours?.week_from_today?.week_periods?.some(p=>p.days?.some(d=>d.on_days))||e.openHours?.headline?.code==='OPEN'));
  const mapPrice=usableMap.some(e=>e.menus?.some(isFixedMenuPrice));
  if(active.length){
    return {status:mapPrice?'price_found':'licensed_operating',reason:closed.length?'동일 상호·주소에 폐업 이력과 현재 정상 영업 인허가가 함께 존재합니다. 폐업 이력만으로 폐업 처리하지 않습니다.':'상호·주소가 일치하는 정상 영업 인허가를 확인했습니다. 현재 메뉴 가격은 별도 확인이 필요합니다.'};
  }
  if(closed.length && mapOpen)return {status:'conflicting',reason:'동일 주소의 폐업 인허가와 지도 영업시간 안내가 상충합니다. 재개업·명의 변경·지도 정보 지연 여부를 추가 확인해야 합니다.'};
  if(closed.length)return {status:'closed_at_address',reason:alternativePlaces.length?'등록된 주소의 폐업 이력이 확인됩니다. 다른 주소의 동명 업소도 있어 브랜드 전체 폐업이나 이전 확정으로 해석하면 안 됩니다.':'상호·주소가 일치하는 인허가에 폐업 이력이 있습니다. 명의 변경·재개업 여부까지 확정한 것은 아니므로 신고일과 현재 입점 상태를 함께 확인해야 합니다.'};
  if(temporary.length)return {status:'temporarily_closed',reason:'상호·주소가 일치하는 휴업 또는 영업정지 인허가 기록입니다. 영구 폐업과 구분합니다.'};
  if(mapOpen)return {status:mapPrice?'price_found':'map_operating',reason:mapPrice?'동일 식당의 지도 영업시간과 공개 메뉴 가격을 확인했습니다.':'동일 식당의 지도 영업시간 안내가 있습니다. 지도 정보 기준이며 전화·현장 확인은 하지 않았습니다.'};
  if(alternativePlaces.length)return {status:'address_review',reason:'같거나 유사한 상호가 다른 주소에서 검색됩니다. 이전·지점 차이·동명 업소 여부를 확인해야 합니다.'};
  if(usableMap.length)return {status:mapPrice?'price_found':'listing_only',reason:'상호·주소가 일치하는 지도 등록은 있으나 현재 영업을 확정할 근거가 부족합니다.'};
  if(/폐업|영업종료/.test(restaurant.name)||restaurant.operationState==='closed')return {status:'closure_unconfirmed',reason:'기존 자료에 폐업 표기가 있으나 이번 조사에서 동일 지점의 최신 독립 근거를 확보하지 못했습니다.'};
  return {status:'unresolved',reason:'조회한 지도·인허가 자료에서 동일 식당을 확정하지 못했습니다. 검색 누락은 폐업 근거가 아닙니다.'};
}

export const STATUS_LABELS={price_found:'가격 추가 확보',licensed_operating:'인허가상 영업 · 가격 미확보',map_operating:'지도상 영업 안내 · 가격 미확보',closed_at_address:'기존 주소 폐업 기록',temporarily_closed:'휴업·영업정지 기록',conflicting:'영업 정보 상충',address_review:'이전·지점 확인 필요',listing_only:'지도 등록만 확인',closure_unconfirmed:'기존 폐업 표기 · 미확정',unresolved:'확인 불가'};
