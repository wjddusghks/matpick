/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID?: string;
  readonly VITE_NAVER_LOGIN_CLIENT_ID?: string;
  readonly VITE_KAKAO_REST_API_KEY?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
  readonly VITE_MONETIZATION_PROVIDER?: string;
  readonly VITE_ADSENSE_CLIENT?: string;
  readonly VITE_ADSENSE_SLOT_INLINE?: string;
  readonly VITE_KAKAO_ADFIT_UNIT?: string;
  readonly VITE_KAKAO_ADFIT_WIDTH?: string;
  readonly VITE_KAKAO_ADFIT_HEIGHT?: string;
  readonly VITE_KAKAO_ADFIT_MOBILE_UNIT?: string;
  readonly VITE_KAKAO_ADFIT_MOBILE_WIDTH?: string;
  readonly VITE_KAKAO_ADFIT_MOBILE_HEIGHT?: string;
  readonly VITE_COUPANG_PARTNERS_URL?: string;
  readonly VITE_COUPANG_BANNER_IMAGE_URL?: string;
  readonly VITE_COUPANG_BANNER_TITLE?: string;
  readonly VITE_COUPANG_DYNAMIC_BANNER_ID?: string;
  readonly VITE_COUPANG_DYNAMIC_BANNER_TEMPLATE?: string;
  readonly VITE_COUPANG_DYNAMIC_BANNER_TRACKING_CODE?: string;
  readonly VITE_COUPANG_DYNAMIC_BANNER_WIDTH?: string;
  readonly VITE_COUPANG_DYNAMIC_BANNER_HEIGHT?: string;
  readonly VITE_GOOGLE_TAG_IDS?: string;
  readonly VITE_META_PIXEL_ID?: string;
  readonly VITE_ADMIN_USER_IDS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
