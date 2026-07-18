import type { ProviderManifest } from "@geowirehq/schema";

/**
 * 고객 자체 데이터 공급자 선언.
 * 자체 데이터이므로 저장·캐시에 제약이 없다(캐시 상한 1일은 인메모리 특성상 형식적).
 * 라우팅 우선순위는 config에서 `priority: 100`으로 두어 자체 매장이 최상위 노출되게 한다(설계 §8).
 */
export const INTERNAL_MANIFEST: ProviderManifest = {
  id: "internal",
  name: "Internal (customer data)",
  capabilities: ["search"],
  authType: "none",
  policy: {
    maxCacheTtlSeconds: 86_400,
    canStorePermanently: true,
  },
};
