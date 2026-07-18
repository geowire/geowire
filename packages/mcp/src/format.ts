import type { Place, ResponseMeta } from "@geowirehq/schema";
import type { ProviderInfo } from "@geowirehq/core";

/** 좌표를 소수점 5자리로 (약 1m 정밀도) */
function coord(n: number): string {
  return n.toFixed(5);
}

/** Place 한 건을 한 줄 요약으로 */
function formatPlace(place: Place, index?: number): string {
  const prefix = index != null ? `${index + 1}. ` : "";
  const parts: string[] = [`${prefix}${place.name}`];
  if (place.address?.formatted) parts.push(place.address.formatted);
  parts.push(`(${coord(place.location.latitude)}, ${coord(place.location.longitude)})`);
  const extras: string[] = [];
  if (place.distanceMeters != null) extras.push(`${Math.round(place.distanceMeters)}m away`);
  if (place.contact?.phone) extras.push(place.contact.phone);
  if (place.business?.openingHours) extras.push(place.business.openingHours);
  if (place.business?.rating != null) {
    extras.push(`★${place.business.rating}${place.business.reviewCount != null ? ` (${place.business.reviewCount})` : ""}`);
  }
  const sources = place.sources.map((s) => `${s.provider}:${s.providerPlaceId}`).join(", ");
  extras.push(`sources: ${sources}`);
  return `${parts.join(" — ")}\n   ${extras.join(" · ")}`;
}

/** meta의 투명성 정보를 한 줄로 (사용/스킵/실패/전략/비용) */
function formatMeta(meta: ResponseMeta): string {
  const bits: string[] = [`strategy: ${meta.strategy}`];
  if (meta.providersUsed.length) bits.push(`used: ${meta.providersUsed.map((u) => u.provider).join(", ")}`);
  if (meta.providersSkipped.length)
    bits.push(`skipped: ${meta.providersSkipped.map((s) => `${s.provider}(${s.reason})`).join(", ")}`);
  if (meta.providersFailed.length)
    bits.push(`failed: ${meta.providersFailed.map((s) => `${s.provider}(${s.reason})`).join(", ")}`);
  if (meta.dedup) bits.push(`dedup: ${meta.dedup.before}→${meta.dedup.after}`);
  if (meta.estimatedCostUSD != null) bits.push(`est. cost: $${meta.estimatedCostUSD.toFixed(4)}`);
  if (meta.cache?.hit) bits.push("cache: hit");
  return bits.join(" | ");
}

/** 검색/지오코딩 결과를 사람이 읽는 요약 텍스트로 */
export function formatResults(results: Place[], meta: ResponseMeta): string {
  const header =
    results.length === 0
      ? "No places found."
      : `Found ${results.length} place${results.length === 1 ? "" : "s"}:`;
  const body = results.map((p, i) => formatPlace(p, i)).join("\n");
  const footer = formatMeta(meta);
  const attribution = meta.attributions.length ? `\nAttribution: ${meta.attributions.join("; ")}` : "";
  return `${header}\n${body}\n\n${footer}${attribution}`.trim();
}

/** get_place 단일 결과 텍스트 */
export function formatSinglePlace(place: Place | null, id: string): string {
  if (!place) {
    return `No place found for id "${id}". Use a provider reference like "google:ChIJ..." or "nominatim:node/123" (from a search result's sources).`;
  }
  const attribution = place.attributions.length ? `\nAttribution: ${place.attributions.join("; ")}` : "";
  return `${formatPlace(place)}${attribution}`;
}

/** list_geo_providers 텍스트 */
export function formatProviders(providers: ProviderInfo[]): string {
  if (providers.length === 0) return "No geo providers configured.";
  const lines = providers.map((p) => {
    const state = p.enabled ? "enabled" : "disabled";
    const attribution = p.attributionRequired ? ` · attribution: ${p.attributionRequired}` : "";
    return `- ${p.id} (${p.name}) — ${state}, auth: ${p.authType}, priority: ${p.priority}, capabilities: ${p.capabilities.join(", ")}${attribution}`;
  });
  return `${providers.length} provider(s):\n${lines.join("\n")}`;
}
