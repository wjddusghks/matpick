# 맛픽 보안 강화 감사 (2026-07-19)

## 결과

- 운영 의존성 감사: 알려진 취약점 32건(높음 14, 보통 15, 낮음 3)에서 0건으로 정리
- 추적 파일 비밀키 패턴 검사: 개인키, AWS 키, GitHub 토큰, OpenAI 키, Slack 토큰 검출 0건
- API 보안 스모크 테스트: 통과
- TypeScript 검사와 프로덕션 빌드(2,234개 모듈, 2,800개 식당 페이지 사전 렌더링): 통과

## 적용한 방어

1. API 입력 검증
   - JSON 본문 최대 크기와 Content-Type 검사
   - 식당 ID·사용자 ID 허용 문자와 최대 길이 검사
   - 닉네임, 댓글, 리뷰, OAuth 코드·state의 길이와 제어문자 검사
   - 과대 요청은 413, 잘못된 미디어 타입은 415로 거부

2. 리뷰·사진 무결성
   - 리뷰 ID, 작성일, 작성시각을 서버에서 생성
   - 사용자 닉네임은 서버 저장 프로필을 우선 사용
   - 리뷰 사진은 HTTPS Vercel Blob 또는 명시적으로 허용한 호스트만 수락
   - 사진 수, URL 길이, Blob 경로, 이미지 형식, 파일 크기를 제한
   - 클라이언트에서도 위험한 링크·이미지 URL을 표시 전에 정규화

3. OAuth와 관리자 접근
   - 카카오·네이버 콜백 URI를 운영 Origin과 공급자별 정확한 경로로 제한
   - OAuth state는 암호학적 난수만 사용
   - 로그인 후 이동 경로는 동일 사이트 내부 경로만 허용
   - 운영 관리자 API는 비공개 `ADMIN_USER_IDS`만 신뢰하고 공개 Vite 환경변수는 인증에 사용하지 않음

4. 요청 출처와 가용성
   - 운영 환경에서는 `VITE_PUBLIC_APP_URL` 및 `APP_ALLOWED_ORIGINS`의 정확한 Origin만 허용
   - 외부 OAuth·KV 응답에 8초 제한과 JSON 응답 크기 제한 적용
   - 운영 환경에서 분산 KV 속도 제한이 없으면 API를 503으로 안전하게 차단
   - IP와 사용자 단위 속도 제한, 보안 이벤트 마스킹 로그 유지

5. 전송·브라우저 보안
   - HSTS `max-age=31536000; includeSubDomains` 추가
   - 기존 CSP, frame 차단, MIME sniffing 차단, Referrer/Permissions 정책 유지
   - 외부 지도 이동 링크를 HTTPS로 통일

6. 공급망
   - 사용하지 않는 Axios 제거
   - `@vercel/blob` 2.6.1로 업데이트
   - Lodash 4.18.1, Undici 6.27.0 이상으로 고정

## 운영 환경 필수값

- `VITE_PUBLIC_APP_URL=https://matpick.co.kr`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- `AUTH_PROFILE_SIGNING_SECRET` (충분히 긴 독립 난수)
- `ADMIN_USER_IDS` (서버 전용 관리자 계정 키)
- `BLOB_READ_WRITE_TOKEN`
- 카카오·네이버 서버 비밀키
- `RATE_LIMIT_ALLOW_MEMORY_FALLBACK=0`

`www` 또는 별도 운영 Origin을 실제로 사용한다면 `APP_ALLOWED_ORIGINS`에 정확한 Origin을 추가한다. 자체 이미지 CDN을 쓰는 경우에만 `REVIEW_IMAGE_ALLOWED_HOSTS`에 호스트를 추가한다. 미리보기 배포에서 메모리 속도 제한이 꼭 필요할 때만 `RATE_LIMIT_ALLOW_MEMORY_FALLBACK=1`을 사용한다.

## 검증 명령

```text
pnpm test:security
cd matpick_all
pnpm audit --prod --audit-level moderate
pnpm check
pnpm build
pnpm report:public-menu-gaps
```

## 참고 기준

- OWASP Input Validation Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html
- OWASP REST Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OAuth 2.0 Security BCP (RFC 9700): https://www.rfc-editor.org/info/rfc9700/
- MDN HSTS: https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security
- Vercel Blob client uploads: https://vercel.com/docs/vercel-blob/client-upload
