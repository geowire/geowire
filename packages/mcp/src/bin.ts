#!/usr/bin/env node
import { createGeoWire, loadConfig } from "@geowire/core";
import type { GeoProvider, Logger } from "@geowire/provider-sdk";
import { createNominatimProvider } from "@geowire/provider-nominatim";
import { createGoogleProvider } from "@geowire/provider-google";
import { createInternalProvider } from "@geowire/provider-internal";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createGeoWireMcpServer } from "./server.js";

/** MCP는 stdout을 프로토콜 전송에 쓰므로 로그는 반드시 stderr로만 낸다 */
const stderrLogger: Logger = {
  debug: () => {},
  info: (message, ...args) => console.error("[geowire:info]", message, ...args),
  warn: (message, ...args) => console.error("[geowire:warn]", message, ...args),
  error: (message, ...args) => console.error("[geowire:error]", message, ...args),
};

async function main(): Promise<void> {
  // Zero-config: nominatim은 키 없이 항상 활성. 나머지는 환경 변수로 opt-in.
  const providers: GeoProvider[] = [createNominatimProvider()];

  const googleKey = process.env.GOOGLE_MAPS_API_KEY;
  if (googleKey) providers.push(createGoogleProvider({ apiKey: googleKey }));

  const internalCsv = process.env.GEOWIRE_INTERNAL_CSV;
  if (internalCsv) providers.push(createInternalProvider({ source: internalCsv }));

  const config = loadConfig(process.env.GEOWIRE_CONFIG);
  const geo = createGeoWire({ providers, config, logger: stderrLogger });

  const server = createGeoWireMcpServer(geo);
  await server.connect(new StdioServerTransport());
  stderrLogger.info(`geowire-mcp ready with ${providers.length} provider(s)`);
}

main().catch((err) => {
  console.error("[geowire:fatal]", err);
  process.exit(1);
});
