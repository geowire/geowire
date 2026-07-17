import { z } from "zod";
import { LatLng } from "./place.js";
import { CountryCode } from "./country.js";

/**
 * 공급자 호출 전략 (설계 §7.2).
 * v0.1 공개 계약은 실제 구현 범위인 `first-success`·`merge`만 노출한다.
 * `fastest`/`weighted`/`cost-aware`는 후속 버전(§11 v0.3)에서 실제 구현·conformance
 * 테스트와 함께 추가한다 — 스키마가 미구현 전략을 유효 입력으로 광고하지 않도록.
 */
export const Strategy = z.enum(["first-success", "merge"]);
export type Strategy = z.infer<typeof Strategy>;

/** 모든 요청에서 공통으로 오버라이드 가능한 옵션 */
export const RequestOptions = z.object({
  strategy: Strategy.optional(),
  /** 이 요청에서 사용할 공급자를 명시적으로 제한 */
  providers: z.array(z.string()).optional(),
  maxCostUSD: z.number().nonnegative().optional(),
  timeoutMs: z.number().int().positive().max(30_000).optional(),
  /** BCP 47 (예: "ko", "vi-VN") */
  language: z.string().optional(),
});
export type RequestOptions = z.infer<typeof RequestOptions>;

export const SearchPlacesRequest = z.object({
  query: z.string().min(1),
  near: LatLng.optional(),
  radiusMeters: z.number().positive().max(100_000).optional(),
  /** ISO 3166-1 alpha-2. 없으면 near 좌표로 추론 */
  country: CountryCode.optional(),
  categories: z.array(z.string()).optional(),
  openNow: z.boolean().optional(),
  limit: z.number().int().min(1).max(50).default(10),
  options: RequestOptions.optional(),
});
export type SearchPlacesRequest = z.infer<typeof SearchPlacesRequest>;

export const GeocodeRequest = z.object({
  address: z.string().min(1),
  country: CountryCode.optional(),
  limit: z.number().int().min(1).max(20).default(5),
  options: RequestOptions.optional(),
});
export type GeocodeRequest = z.infer<typeof GeocodeRequest>;

export const ReverseGeocodeRequest = z.object({
  location: LatLng,
  options: RequestOptions.optional(),
});
export type ReverseGeocodeRequest = z.infer<typeof ReverseGeocodeRequest>;

export const GetPlaceRequest = z.object({
  /** 내부 ID("gwp_...") 또는 "provider:providerPlaceId" 참조 */
  id: z.string().min(1),
  options: RequestOptions.optional(),
});
export type GetPlaceRequest = z.infer<typeof GetPlaceRequest>;

export const AutocompleteRequest = z.object({
  input: z.string().min(1),
  near: LatLng.optional(),
  country: CountryCode.optional(),
  limit: z.number().int().min(1).max(20).default(5),
  options: RequestOptions.optional(),
});
export type AutocompleteRequest = z.infer<typeof AutocompleteRequest>;
