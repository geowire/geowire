import type { ProviderManifest } from "@geowire/schema";

/**
 * Nominatim/OSM 공급자 선언. coverage 생략 = 글로벌.
 * policy: ODbL이므로 영속 저장 허용, 캐시 24h 상한, OSM attribution 필수.
 */
export const NOMINATIM_MANIFEST: ProviderManifest = {
  id: "nominatim",
  name: "Nominatim (OpenStreetMap)",
  capabilities: ["search", "geocode", "reverseGeocode"],
  authType: "none",
  policy: {
    maxCacheTtlSeconds: 86_400,
    canStorePermanently: true,
    attributionRequired: "© OpenStreetMap contributors",
  },
  rateLimit: { requestsPerSecond: 1 },
};
