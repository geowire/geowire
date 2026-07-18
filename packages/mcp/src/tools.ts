import { z } from "zod";
import {
  SearchPlacesRequest,
  GeocodeRequest,
  ReverseGeocodeRequest,
  GetPlaceRequest,
} from "@geowire/schema";
import type { GeoWire } from "@geowire/core";
import { GeoProviderError } from "@geowire/provider-sdk";
import type { CallToolResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import { formatResults, formatSinglePlace, formatProviders } from "./format.js";

/**
 * Zod 스키마를 MCP inputSchema(JSON Schema)로 변환한다 (설계 §9.1 "수기 금지, 자동 생성").
 * - `$schema` 메타 키 제거(MCP inputSchema에 불필요)
 * - default가 있는 필드는 required에서 제외(클라이언트가 생략 가능함을 정확히 광고)
 */
function toInputSchema(schema: z.ZodType): Tool["inputSchema"] {
  const json = z.toJSONSchema(schema) as Record<string, unknown> & {
    properties?: Record<string, { default?: unknown }>;
    required?: string[];
  };
  delete json.$schema;
  if (json.required && json.properties) {
    json.required = json.required.filter((key) => json.properties![key]?.default === undefined);
    if (json.required.length === 0) delete json.required;
  }
  return json as Tool["inputSchema"];
}

const EMPTY_INPUT: Tool["inputSchema"] = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

/**
 * 도구 설명문 = 제품 (설계 §9.1).
 * LLM이 올바른 도구를 고르고 인자를 채우도록 목적·구분·예시를 명시한다.
 */
export const TOOL_DEFS: Tool[] = [
  {
    name: "search_places",
    description:
      "Search for places (businesses, points of interest, landmarks) by a natural-language query, " +
      "optionally biased to a coordinate (`near`) and/or restricted to a country. Returns places ranked " +
      "by relevance/distance, each with location, address, contact, opening hours, and its data source(s). " +
      "Use this for 'find X near Y' requests. " +
      'Example: {"query": "24-hour pharmacy", "near": {"latitude": 10.7769, "longitude": 106.7009}, "radiusMeters": 2000}. ' +
      "To turn an address into coordinates use geocode_address instead; to look up one known place use get_place.",
    inputSchema: toInputSchema(SearchPlacesRequest),
  },
  {
    name: "get_place",
    description:
      "Fetch full details for a single place by its provider reference id, in the form " +
      "'provider:providerPlaceId' (e.g. 'google:ChIJN1t_tDeuEmsRUsoyG83frY4' or 'nominatim:node/240109189'), " +
      "as found in a place's `sources`. Internal 'gwp_' ids cannot be resolved directly — re-query via a " +
      'provider reference. Example: {"id": "nominatim:node/240109189"}.',
    inputSchema: toInputSchema(GetPlaceRequest),
  },
  {
    name: "geocode_address",
    description:
      "Convert a street address or place name into geographic coordinates and a normalized address. " +
      "Use this when you have an address string and need latitude/longitude. " +
      'Example: {"address": "1600 Amphitheatre Parkway, Mountain View, CA"}. ' +
      "To search for businesses by name/category, use search_places.",
    inputSchema: toInputSchema(GeocodeRequest),
  },
  {
    name: "reverse_geocode",
    description:
      "Convert geographic coordinates into the nearest address / place. " +
      'Example: {"location": {"latitude": 37.5665, "longitude": 126.9780}}.',
    inputSchema: toInputSchema(ReverseGeocodeRequest),
  },
  {
    name: "list_geo_providers",
    description:
      "List the geo data providers currently configured, with their capabilities, enabled state, priority, " +
      "and required attribution. Use this to understand which data sources are available (e.g. whether Google " +
      "is configured) before choosing a strategy or explaining coverage. Takes no arguments.",
    inputSchema: EMPTY_INPUT,
  },
];

function textResult(text: string, structuredContent?: Record<string, unknown>): CallToolResult {
  const result: CallToolResult = { content: [{ type: "text", text }] };
  if (structuredContent) result.structuredContent = structuredContent;
  return result;
}

function errorResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }], isError: true };
}

/** Zod 검증 실패를 LLM이 자가 수정 가능한 메시지로 (설계 §9.1) */
function formatZodError(toolName: string, err: z.ZodError): string {
  const issues = err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
  return `Invalid arguments for ${toolName}: ${issues}.`;
}

/**
 * 도구 호출을 GeoWire 퍼사드로 위임한다.
 * 응답은 사람이 읽는 요약 텍스트 + `structuredContent`(스키마 준수 JSON)를 함께 담는다.
 */
export async function dispatchTool(
  geo: GeoWire,
  name: string,
  args: Record<string, unknown>,
): Promise<CallToolResult> {
  try {
    switch (name) {
      case "search_places": {
        const res = await geo.searchPlaces(args);
        return textResult(formatResults(res.results, res.meta), res);
      }
      case "geocode_address": {
        const res = await geo.geocode(args);
        return textResult(formatResults(res.results, res.meta), res);
      }
      case "reverse_geocode": {
        const res = await geo.reverseGeocode(args);
        return textResult(formatResults(res.results, res.meta), res);
      }
      case "get_place": {
        const parsed = GetPlaceRequest.parse(args);
        const place = await geo.getPlace(parsed);
        return textResult(formatSinglePlace(place, parsed.id), { place });
      }
      case "list_geo_providers": {
        const providers = geo.listProviders();
        return textResult(formatProviders(providers), { providers });
      }
      default:
        return errorResult(`Unknown tool: ${name}`);
    }
  } catch (err) {
    if (err instanceof z.ZodError) return errorResult(formatZodError(name, err));
    if (err instanceof GeoProviderError) {
      return errorResult(`Provider error (${err.code}) from ${err.provider ?? "provider"}: ${err.message}`);
    }
    return errorResult(`Tool ${name} failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}
