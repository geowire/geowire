# GeoWire

> **Add real-world places to any AI agent in 5 minutes — no API key required.**
>
> One place-search interface for every AI and map provider.

GeoWire is an open-source geo search gateway that sits between AI agents and
map/place data providers (OpenStreetMap, Google, Mapbox, Kakao, Naver, your own
data) and exposes them through a single MCP server, REST API, and SDK.

**Status: pre-alpha — under active development. Not ready for use yet.**

## Why GeoWire?

|  | Direct integration | Single-provider MCP | **GeoWire** |
|---|---|---|---|
| Unified place schema | ❌ per-provider code | ❌ | ✅ |
| Provider fallback on failure | ❌ | ❌ | ✅ |
| Multi-provider merge + dedup | ❌ | ❌ | ✅ |
| Cost budgets & routing | ❌ | ❌ | ✅ |
| Works without any API key | ❌ | depends | ✅ (OSM by default) |
| Self-hosted | — | depends | ✅ |
| Your own place data as a provider | ❌ | ❌ | ✅ |

## Quickstart (planned DX)

```bash
# Zero-config server — OpenStreetMap works out of the box
npx geowire
```

```json
// Claude Desktop / Cursor — MCP over stdio
{
  "mcpServers": {
    "geowire": { "command": "npx", "args": ["-y", "@geowire/mcp"] }
  }
}
```

## Documentation

- [System design](./GeoWire_system_design.md)
- Spec: `specs/` (place schema · provider manifest) — coming with v0.3

## License

[Apache-2.0](./LICENSE). GeoWire's code license is separate from the terms of
third-party map/place data providers — usage of Google, Mapbox, HERE, Kakao,
Naver, etc. is governed by each provider's own terms. OSM data is under ODbL.
