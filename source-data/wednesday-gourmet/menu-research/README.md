# 수요미식회 메뉴 별도 수집본

수요미식회 555개 식당의 메뉴명과 가격을 기존 원본 데이터와 분리해 누적합니다.

## 원칙

- 식당별 JSON 파일 하나를 사용합니다.
- 메뉴 가격은 확인한 화면에 표시된 문자열 그대로 기록합니다.
- `verified`는 서로 독립적인 출처가 2개 이상이고 가격이 일치할 때만 사용합니다.
- 가격이 충돌하거나 최신 여부가 불분명하면 `needs-review`로 두며 앱에는 반영하지 않습니다.
- 각 메뉴는 근거 출처 ID, 확인일, 신뢰도를 포함합니다.
- 폐업 확인은 `closed`, 유효한 메뉴 정보를 찾지 못한 경우는 `not-found`로 기록합니다.

## 명령

`matpick_all` 폴더에서 실행합니다.

```powershell
pnpm research:wednesday-menus -- status
pnpm research:wednesday-menus -- next --limit 20
pnpm collect:wednesday-menus -- --limit 20
pnpm collect:wednesday-menus -- --all
pnpm research:wednesday-menus -- apply
```

`apply`는 교차검증을 통과한 `verified` 항목과, 단일 출처이지만 가격 충돌이 없고
신뢰도 65 이상인 숫자 가격 메뉴를
`client/src/data/generated/wednesday-gourmet.menu-research.generated.json`에 생성합니다.
가격이 서로 다르거나 범위로만 확인된 메뉴는 앱 반영에서 제외합니다.

`collect`는 아직 JSON이 없는 식당만 대상으로 다이닝코드와 네이버 플레이스의
공개 메뉴를 조사합니다. 동일 메뉴명과 가격이 두 출처에서 일치한 항목만
`verified`로 저장하며, 가격 충돌이나 단일 출처 메뉴는 `needs-review`로 분리합니다.
