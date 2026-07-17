import { z } from "zod";
import { Place } from "./place.js";
import { ProviderErrorCode } from "./errors.js";
import { Strategy } from "./requests.js";

export const ProviderUsage = z.object({
  provider: z.string(),
  resultCount: z.number().int().nonnegative(),
  latencyMs: z.number().nonnegative(),
});
export type ProviderUsage = z.infer<typeof ProviderUsage>;

export const ProviderSkip = z.object({
  provider: z.string(),
  reason: ProviderErrorCode,
});
export type ProviderSkip = z.infer<typeof ProviderSkip>;

/**
 * 응답 봉투의 meta 블록 — 투명성 원칙(P8)의 구현.
 * 어떤 공급자를 썼고, 무엇을 건너뛰었고, 비용이 얼마인지 항상 노출한다.
 */
export const ResponseMeta = z.object({
  providersUsed: z.array(ProviderUsage),
  providersSkipped: z.array(ProviderSkip).default([]),
  providersFailed: z.array(ProviderSkip).default([]),
  strategy: Strategy,
  dedup: z
    .object({
      before: z.number().int().nonnegative(),
      after: z.number().int().nonnegative(),
    })
    .optional(),
  cache: z
    .object({
      hit: z.boolean(),
      ttlSeconds: z.number().int().nonnegative().optional(),
    })
    .optional(),
  estimatedCostUSD: z.number().nonnegative().optional(),
  attributions: z.array(z.string()).default([]),
});
export type ResponseMeta = z.infer<typeof ResponseMeta>;

export const SearchPlacesResponse = z.object({
  results: z.array(Place),
  meta: ResponseMeta,
});
export type SearchPlacesResponse = z.infer<typeof SearchPlacesResponse>;
