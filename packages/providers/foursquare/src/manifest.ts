import type { ProviderManifest } from "@geowirehq/schema";

/**
 * Foursquare Places 공급자 선언 (BYOK — Service API key).
 * 글로벌 POI 검색·상세. 좌표는 WGS84라 변환 불필요.
 * capabilities: search + getPlace (지오코딩/리버스는 미지원 — POI 중심 API).
 * policy: 약관상 원본 영속 저장 금지(보수적), 캐시 24h 상한, 출처 표기 필수.
 */
export const FOURSQUARE_MANIFEST: ProviderManifest = {
  id: "foursquare",
  name: "Foursquare Places",
  capabilities: ["search", "getPlace"],
  authType: "apiKey",
  policy: {
    maxCacheTtlSeconds: 86_400,
    canStorePermanently: false,
    attributionRequired: "Powered by Foursquare",
  },
};
