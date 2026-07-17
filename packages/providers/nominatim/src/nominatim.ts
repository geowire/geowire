import {
  defineProvider,
  errorFromHttpStatus,
  type GeoProvider,
  type ProviderContext,
} from "@geowire/provider-sdk";
import type {
  SearchPlacesRequest,
  GeocodeRequest,
  ReverseGeocodeRequest,
} from "@geowire/schema";
import { NOMINATIM_MANIFEST } from "./manifest.js";
import { RateLimiter } from "./rate-limit.js";
import { parseResults } from "./parse.js";

const VERSION = "0.1.0";
const DEFAULT_BASE_URL = "https://nominatim.openstreetmap.org";

export interface NominatimOptions {
  /** 자체 호스팅 Nominatim으로 전환 (공용 서버 부하 회피) */
  baseUrl?: string;
  /** 필수 User-Agent. 기본값은 프로젝트 식별 UA */
  userAgent?: string;
  /** OSM 정책 권장 연락 이메일 (쿼리에 첨부) */
  email?: string;
  /** 초당 요청 상한. 기본 1 (공용 서버 예절) */
  requestsPerSecond?: number;
  /** 대기 구현 주입 (테스트용). 기본 setTimeout */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Nominatim(OpenStreetMap) 공급자를 만든다 — **키 불필요, Zero-config의 근간(P1)**.
 * 1 req/s rate limit과 식별 User-Agent를 내부에서 강제한다(호출자가 끌 수 없음).
 */
export function createNominatimProvider(options: NominatimOptions = {}): GeoProvider {
  const baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
  const userAgent = options.userAgent ?? `geowire/${VERSION} (+https://geowire.dev)`;
  const intervalMs = 1000 / (options.requestsPerSecond ?? 1);
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const limiter = new RateLimiter(intervalMs, sleep);

  async function request(
    path: string,
    params: Record<string, string | undefined>,
    ctx: ProviderContext,
  ): Promise<unknown> {
    await limiter.acquire(ctx.now());
    const url = new URL(`${baseUrl}${path}`);
    url.searchParams.set("format", "jsonv2");
    url.searchParams.set("addressdetails", "1");
    for (const [key, value] of Object.entries(params)) {
      if (value != null && value !== "") url.searchParams.set(key, value);
    }
    if (options.email) url.searchParams.set("email", options.email);

    const res = await ctx.fetch(url.toString(), {
      headers: { "User-Agent": userAgent, Accept: "application/json" },
    });
    if (!res.ok) throw errorFromHttpStatus(res.status, { provider: "nominatim" });
    return res.json();
  }

  return defineProvider({
    manifest: NOMINATIM_MANIFEST,

    async searchPlaces(req: SearchPlacesRequest, ctx) {
      const raw = await request(
        "/search",
        {
          q: req.query,
          limit: String(req.limit ?? 10),
          countrycodes: req.country?.toLowerCase(),
        },
        ctx,
      );
      return parseResults(raw);
    },

    async geocode(req: GeocodeRequest, ctx) {
      const raw = await request(
        "/search",
        {
          q: req.address,
          limit: String(req.limit ?? 5),
          countrycodes: req.country?.toLowerCase(),
        },
        ctx,
      );
      return parseResults(raw);
    },

    async reverseGeocode(req: ReverseGeocodeRequest, ctx) {
      const raw = await request(
        "/reverse",
        {
          lat: String(req.location.latitude),
          lon: String(req.location.longitude),
        },
        ctx,
      );
      return parseResults(raw);
    },
  });
}
