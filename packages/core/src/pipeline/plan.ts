import type { GeoWireConfig } from "../config/schema.js";
import type { ProviderRegistry } from "../registry.js";
import { resolveStrategy } from "./normalize-request.js";
import type { OperationPlan, OperationSpec } from "./types.js";

/**
 * 주어진 순서 목록으로 후보를 필터·재정렬한다.
 * `order`에 있고 `available`에도 있는 것만, `order`의 순서대로.
 */
function reorderBy(available: string[], order: string[]): string[] {
  const set = new Set(available);
  return order.filter((id) => set.has(id));
}

/**
 * 호출 계획을 세운다 (설계 §7.1 Plan):
 * capability 지원 → 국가별 라우팅 순서 → 요청 단위 provider 제한 → 전략 확정.
 *
 * 자격증명·예산 필터는 여기서 사전 제외하지 않는다 — 자격증명은 실행 시 `MISSING_CREDENTIALS`로,
 * 예산은 execute 직전 cost 게이트(M4)로 처리해 meta에 정확히 기록한다.
 */
export function planOperation(
  registry: ProviderRegistry,
  config: GeoWireConfig,
  spec: OperationSpec,
): OperationPlan {
  // 1. capability 지원 활성 provider (priority 정렬됨)
  let ids = registry.supporting(spec.capability).map((r) => r.id);

  // 2. 국가별 라우팅 순서 오버라이드
  if (spec.country) {
    const routed = config.routing.countries[spec.country]?.providers;
    if (routed && routed.length > 0) ids = reorderBy(ids, routed);
  }

  // 3. 요청 단위 provider 제한 (options.providers)
  const requested = spec.options?.providers;
  if (requested && requested.length > 0) ids = reorderBy(ids, requested);

  const strategy = resolveStrategy(config, spec.options, spec.country);
  return { strategy, providerIds: ids };
}
