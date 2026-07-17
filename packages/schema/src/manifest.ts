import { z } from "zod";
import { CountryCode } from "./country.js";

/** 공급자가 지원할 수 있는 기능 (spec: provider-manifest/v1) */
export const Capability = z.enum([
  "search",
  "autocomplete",
  "geocode",
  "reverseGeocode",
  "getPlace",
]);
export type Capability = z.infer<typeof Capability>;

/**
 * GeoWire Provider Manifest (spec: provider-manifest/v1).
 * 공급자의 capability·커버리지·비용 모델·데이터 정책을 기계가 읽는 형식으로 선언한다.
 * `policy`는 Policy Engine이 캐시 TTL 상한·영속 저장·표시 의무를 강제하는 근거다.
 */
export const ProviderManifest = z.object({
  /** 소문자 슬러그 (예: "nominatim", "google") */
  id: z.string().regex(/^[a-z][a-z0-9-]*$/),
  name: z.string().min(1),
  capabilities: z.array(Capability).min(1),
  authType: z.enum(["apiKey", "oauth", "none"]),
  /** ISO 3166-1 alpha-2 국가코드 목록. 비어 있으면 글로벌 */
  coverage: z.array(CountryCode).optional(),
  /** 비용 기반 라우팅(cost-aware)의 데이터원 */
  cost: z
    .object({
      currency: z.literal("USD"),
      perCall: z.partialRecord(Capability, z.number().nonnegative()),
    })
    .optional(),
  /** 공급자 약관의 기계화 — GeoWire의 핵심 차별점 */
  policy: z.object({
    /** null = 캐시 금지 */
    maxCacheTtlSeconds: z.number().int().nonnegative().nullable(),
    /** false면 providerPlaceId + 내부 ID 외 원본 저장 차단 */
    canStorePermanently: z.boolean(),
    attributionRequired: z.string().optional(),
  }),
  rateLimit: z
    .object({
      requestsPerSecond: z.number().positive().optional(),
    })
    .optional(),
});
export type ProviderManifest = z.infer<typeof ProviderManifest>;
