import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyOperation,matchAuditIdentity,isFixedMenuPrice} from '../../scripts/menu-research/operation-audit.mjs';
const restaurant={name:'서울 예시식당',address:'서울 강남구 도산대로 123',region:'서울 강남구'};
const hours={match:{accepted:true},listingStatus:'Y',openHours:{headline:{code:'CLOSED',display_text:'영업 종료'},week_from_today:{week_periods:[{days:[{on_days:{start_end_time_desc:'10:00 ~ 20:00'}}]}]}}};
test('today closing time and a regular day off do not mean permanent closure',()=>{
  assert.equal(classifyOperation({restaurant,mapEvidence:[hours]}).status,'map_operating');
  const dayOff={...hours,openHours:{...hours.openHours,headline:{code:'DAY_OFF',display_text:'휴무일'}}};
  assert.equal(classifyOperation({restaurant,mapEvidence:[dayOff]}).status,'map_operating');
});
test('reopened or transferred licenses are not classified closed from old history',()=>{
  assert.equal(classifyOperation({restaurant,licenses:[{status:'폐업'},{status:'영업/정상'}]}).status,'licensed_operating');
});
test('a matching closed license conflicts with a current map schedule',()=>{
  assert.equal(classifyOperation({restaurant,licenses:[{status:'폐업(자진)'}],mapEvidence:[hours]}).status,'conflicting');
});
test('missing prices, listing status and search absence do not prove closure',()=>{
  assert.equal(classifyOperation({restaurant,mapEvidence:[]}).status,'unresolved');
  assert.equal(classifyOperation({restaurant,mapEvidence:[{match:{accepted:true},listingStatus:'Y'}]}).status,'listing_only');
  assert.equal(classifyOperation({restaurant:{...restaurant,name:'서울 예시식당 (현재 폐업)'}}).status,'closure_unconfirmed');
});
test('same name at a different address cannot be accepted as the original branch',()=>{
  assert.equal(matchAuditIdentity(restaurant,{name:'예시식당',address:'서울 강남구 도산대로 456'}).accepted,false);
  assert.equal(classifyOperation({restaurant,alternativePlaces:[{name:'예시식당',address:'서울 강남구 도산대로 456'}]}).status,'address_review');
});
test('a license branch suffix or by transliteration is matched only at the same address',()=>{
  assert.equal(matchAuditIdentity({...restaurant,name:'서울 예시식당 역삼점'},{name:'예시식당',address:restaurant.address}).accepted,true);
  assert.equal(matchAuditIdentity({...restaurant,name:'가겐 바이 최준호'},{name:'가겐by최준호',address:restaurant.address}).accepted,true);
  assert.equal(matchAuditIdentity({...restaurant,name:'가겐 바이 최준호'},{name:'가겐by최준호',address:'서울 강남구 도산대로 999'}).accepted,false);
});
test('same brand on another floor is not the same restaurant record',()=>{
  const r={name:'기와강',address:'강남구 논현로 152길 9, 4층, Seoul, 06025, 한국'};
  assert.equal(matchAuditIdentity(r,{name:'기와강',address:'서울 강남구 논현로152길 9 4층'}).accepted,true);
  assert.equal(matchAuditIdentity(r,{name:'기와강 프라이빗',address:'서울 강남구 논현로152길 9 5층'}).accepted,false);
});
test('a restaurant charging station is not restaurant operating evidence',()=>{
  const restaurant={name:'원조선창집장어구이',address:'인천 강화군 선원면 해안동로 1199',region:'인천 강화군'};
  assert.equal(matchAuditIdentity(restaurant,{name:'원조선창집장어구이 전기차충전소',address:restaurant.address,category:'교통'}).accepted,false);
});
test('numbered street-name legal districts match their parcel addresses',()=>{
  const r={name:'중앙회관',address:'서울 중구 충무로1가 24-11',region:'서울 중구'};
  assert.equal(matchAuditIdentity(r,{name:'중앙회관',address:'서울특별시 중구 명동8나길 19 (충무로1가)',parcelAddress:'서울특별시 중구 충무로1가 24-11'}).accepted,true);
  assert.equal(matchAuditIdentity(r,{name:'중앙회관',address:'서울 중구 충무로1가 24-12'}).accepted,false);
});
test('fees, zero prices and variable prices cannot count as fixed meal prices',()=>{
  for(const m of [{name:'셋팅비',price:'30,000원'},{name:'무료 서비스',price:'0원'},{name:'디너코스(변동)',price:'330,000원'},{name:'회',price:'시가'}])assert.equal(isFixedMenuPrice(m),false);
  assert.equal(isFixedMenuPrice({name:'점심코스',price:'55,000원'}),true);
});
