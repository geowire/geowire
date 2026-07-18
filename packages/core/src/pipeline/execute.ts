import {
  createRetryingFetch,
  GeoProviderError,
  type ProviderContext,
  type ProviderPlace,
  type Logger,
  type Clock,
  type FetchFn,
} from "@geowire/provider-sdk";
import type { RegisteredProvider, ProviderRegistry } from "../registry.js";
import type { CircuitBreaker } from "../circuit-breaker.js";
import type { ListRequest, OperationPlan, OperationSpec, ProviderInvocation } from "./types.js";
import { firstSuccess } from "./strategies/first-success.js";
import { mergeAll } from "./strategies/merge.js";

/** per-provider 기본 타임아웃 (설계 §7.1) */
const DEFAULT_PROVIDER_TIMEOUT_MS = 3000;

export interface ExecuteDeps {
  logger: Logger;
  now: Clock;
  baseFetch: FetchFn;
  /** 상위(요청 단위) 취소 신호 */
  signal?: AbortSignal;
  /** 공급자별 서킷 브레이커 (open 시 호출 제외 + 결과 기록) */
  breaker?: CircuitBreaker;
}

type ProviderMethod = (req: ListRequest, ctx: ProviderContext) => Promise<ProviderPlace[]>;

/** provider가 이번 연산에서 쓸 실행 컨텍스트를 만든다 (재시도·타임아웃 fetch 주입) */
export function makeContext(deps: ExecuteDeps, timeoutMs: number): ProviderContext {
  return {
    fetch: createRetryingFetch(
      { baseFetch: deps.baseFetch, logger: deps.logger, now: deps.now, signal: deps.signal },
      { timeoutMs },
    ),
    logger: deps.logger,
    now: deps.now,
    signal: deps.signal,
  };
}

/** 임의의 throw를 정규화된 GeoProviderError로 변환 */
function normalizeError(err: unknown, providerId: string): GeoProviderError {
  if (err instanceof GeoProviderError) {
    // provider 필드가 비어 있으면 채워 넣는다
    return err.provider ? err : new GeoProviderError(err.code, err.message, {
      provider: providerId,
      status: err.status,
      cause: err.cause,
    });
  }
  return new GeoProviderError("PROVIDER_UNAVAILABLE", `${providerId}: ${String(err)}`, {
    provider: providerId,
    cause: err,
  });
}

/** 단일 공급자를 1회 호출하고 결과/실패를 타이밍과 함께 기록한다 */
async function invokeOne(
  rp: RegisteredProvider,
  spec: OperationSpec,
  deps: ExecuteDeps,
): Promise<ProviderInvocation> {
  // 회로 open이면 호출하지 않고 skip으로 기록
  if (deps.breaker?.isOpen(rp.id)) {
    return {
      id: rp.id,
      ok: false,
      places: [],
      latencyMs: 0,
      skipped: true,
      error: new GeoProviderError("PROVIDER_UNAVAILABLE", `${rp.id} circuit open`, {
        provider: rp.id,
      }),
    };
  }

  const timeoutMs = spec.options?.timeoutMs ?? DEFAULT_PROVIDER_TIMEOUT_MS;
  const ctx = makeContext(deps, timeoutMs);
  const fn = rp.provider[spec.method] as ProviderMethod | undefined;
  const start = deps.now();
  if (typeof fn !== "function") {
    return {
      id: rp.id,
      ok: false,
      places: [],
      latencyMs: 0,
      skipped: true,
      error: new GeoProviderError(
        "UNSUPPORTED_CAPABILITY",
        `${rp.id} does not implement ${spec.method}`,
        { provider: rp.id },
      ),
    };
  }
  try {
    const places = await fn.call(rp.provider, spec.request, ctx);
    deps.breaker?.recordSuccess(rp.id);
    return { id: rp.id, ok: true, places, latencyMs: deps.now() - start };
  } catch (err) {
    const error = normalizeError(err, rp.id);
    deps.breaker?.recordFailure(rp.id, error.code);
    return {
      id: rp.id,
      ok: false,
      places: [],
      latencyMs: deps.now() - start,
      error,
    };
  }
}

/**
 * 계획된 공급자들을 전략에 따라 호출한다 (설계 §7.1 Execute).
 * first-success: 순차, 첫 결과에서 정지. merge: 전부 병렬.
 * 각 호출의 성공/실패는 ProviderInvocation으로 수집되어 meta 조립에 쓰인다.
 */
export async function executeOperation(
  registry: ProviderRegistry,
  plan: OperationPlan,
  spec: OperationSpec,
  deps: ExecuteDeps,
): Promise<ProviderInvocation[]> {
  const providers = plan.providerIds
    .map((id) => registry.get(id))
    .filter((r): r is RegisteredProvider => r != null);

  const invoke = (rp: RegisteredProvider): Promise<ProviderInvocation> =>
    invokeOne(rp, spec, deps);

  return plan.strategy === "merge"
    ? mergeAll(providers, invoke)
    : firstSuccess(providers, invoke);
}
