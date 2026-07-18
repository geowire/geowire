import { createGeoWire, loadConfig, type GeoWire } from "@geowire/core";
import type { GeoProvider, Logger } from "@geowire/provider-sdk";
import { createNominatimProvider } from "@geowire/provider-nominatim";
import { createGoogleProvider } from "@geowire/provider-google";
import { createInternalProvider } from "@geowire/provider-internal";

/**
 * 환경 변수로 GeoWire 인스턴스를 구성한다 (설계 §8.1 Zero-config + BYOK).
 * - nominatim: 항상 활성(키 불필요)
 * - google: `GOOGLE_MAPS_API_KEY` 있으면 추가
 * - internal: `GEOWIRE_INTERNAL_CSV`(파일 경로) 있으면 추가
 * - config: `GEOWIRE_CONFIG`(YAML 경로) 있으면 로드, 없으면 zero-config 기본값
 */
export function createGeoFromEnv(logger?: Logger): GeoWire {
  const providers: GeoProvider[] = [createNominatimProvider()];

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) providers.push(createGoogleProvider({ apiKey: googleKey }));

  const internalCsv = process.env.GEOWIRE_INTERNAL_CSV;
  if (internalCsv) providers.push(createInternalProvider({ source: internalCsv }));

  const config = loadConfig(process.env.GEOWIRE_CONFIG);
  return createGeoWire({ providers, config, logger });
}
