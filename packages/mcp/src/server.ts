import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { GeoWire } from "@geowirehq/core";
import { TOOL_DEFS, dispatchTool } from "./tools.js";

/**
 * GeoWire MCP 서버를 만든다 (설계 §9.1 — MCP는 1등 시민 인터페이스).
 * 5개 도구를 노출하고, 호출을 주입된 GeoWire 퍼사드로 위임한다.
 * 전송(stdio/HTTP)은 호출자가 `server.connect(transport)`로 연결한다.
 */
export function createGeoWireMcpServer(geo: GeoWire): Server {
  const server = new Server(
    { name: "geowire", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_DEFS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    dispatchTool(geo, request.params.name, (request.params.arguments ?? {}) as Record<string, unknown>),
  );

  return server;
}
