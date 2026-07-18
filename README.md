# GeoWire

> **Add real-world places to any AI agent in 5 minutes — no API key required.**
>
> One place-search interface for every AI and map provider.

GeoWire is an open-source geo search gateway that sits between AI agents and
map/place data providers (OpenStreetMap, Google, your own data) and exposes them
through a single **MCP server**, **REST API**, and **SDK** — with provider
fallback, multi-provider merge + dedup, cost budgets, and a policy engine that
enforces each provider's caching/attribution terms.

**Status: v0.1 ("It works") — MCP · REST · CLI · SDK all functional. Not yet published to npm.**

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
| Transparent provenance (which source, what cost) | ❌ | ❌ | ✅ (every response) |

## Quickstart

### 1. MCP (Claude Desktop / Cursor) — 30 seconds

Add this to your MCP client config (e.g. Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "geowire": { "command": "npx", "args": ["-y", "@geowirehq/mcp"] }
  }
}
```

Then ask: *"Find a 24-hour pharmacy near District 1, Ho Chi Minh City."*
Works with **zero API keys** — OpenStreetMap is the default provider.
Add `"env": { "GOOGLE_MAPS_API_KEY": "..." }` to enable Google.

### 2. CLI — one-shot search & server

```bash
npx geowire search "coffee near Gangnam"   # terminal search with a results table
npx geowire                                # start the REST + MCP server (zero-config)
npx geowire init                           # interactive setup wizard (.env + config)
npx geowire test                           # check provider connections
```

### 3. Docker — self-hosted server

```bash
docker run -p 4980:4980 geowire/geowire
# then:
curl -X POST http://localhost:4980/v1/places/search \
  -H 'content-type: application/json' \
  -d '{"query":"pharmacy","near":{"latitude":10.7769,"longitude":106.7009}}'
```

Or with `docker compose up` (see `docker-compose.yml`). API docs at `/docs`.

### 4. SDK (embedded)

```ts
import { createGeoWire } from "@geowirehq/core";
import { createNominatimProvider } from "@geowirehq/provider-nominatim";

const geo = createGeoWire({ providers: [createNominatimProvider()] });
const { results, meta } = await geo.searchPlaces({
  query: "coffee",
  near: { latitude: 37.5, longitude: 127.0 },
});
```

## MCP tools

| Tool | Description |
|---|---|
| `search_places` | Natural-language + coordinate/region place search |
| `get_place` | Details by `provider:providerPlaceId` reference |
| `geocode_address` | Address → coordinates (+ normalized address) |
| `reverse_geocode` | Coordinates → nearest address |
| `list_geo_providers` | Active providers, capabilities, status (agent self-awareness) |

Every response includes both a human-readable summary and `structuredContent`
(schema-valid JSON).

## REST endpoints

| Method | Path | |
|---|---|---|
| POST | `/v1/places/search` | search |
| GET | `/v1/places/{ref}` | place details (`provider:id`) |
| GET | `/v1/geocode?address=` | geocode |
| GET | `/v1/reverse-geocode?lat=&lon=` | reverse geocode |
| GET | `/v1/providers` | list providers |
| GET | `/v1/health` | health check |
| GET | `/metrics` | Prometheus metrics |
| GET | `/docs` | Swagger UI (OpenAPI 3.1) |
| POST | `/mcp` | MCP over Streamable HTTP |

Optional Bearer auth: set `GEOWIRE_API_KEYS=key1,key2`.

## Configuration (optional — everything works without it)

`geowire.config.yaml`:

```yaml
providers:
  nominatim: { enabled: true }                       # default ON, no key
  google:    { enabled: true, apiKey: ${GOOGLE_MAPS_API_KEY} }
  internal:  { enabled: true, source: ./my-places.csv, priority: 100 }
routing:
  defaultStrategy: merge          # first-success | merge
budget:
  perRequestMaxUSD: 0.10          # over-budget paid providers are skipped, free ones used
```

Keys come from the environment (`${VAR}`), never committed in plaintext.

## Providers

| Provider | Key? | Capabilities |
|---|---|---|
| `@geowirehq/provider-nominatim` (OpenStreetMap) | none | search, geocode, reverseGeocode |
| `@geowirehq/provider-google` (Maps Platform) | BYOK | search, geocode, reverseGeocode, getPlace |
| `@geowirehq/provider-internal` (your CSV) | none | search |

Want another provider? See [CONTRIBUTING.md](./CONTRIBUTING.md) —
*"Write a provider in 30 minutes"*.

## Architecture

```
AI agent / app
   │  MCP · REST · SDK
   ▼
GeoWire core  ── pipeline: plan → execute → normalize → dedup → rank → policy → cache
   │  GeoProvider contract
   ▼
providers: nominatim · google · internal · (community)
```

Monorepo packages: `schema` · `provider-sdk` · `provider-testkit` · `core` ·
`providers/*` · `mcp` · `apps/server` · `cli`.

## Documentation

- [System design](./GeoWire_system_design.md)
- [Implementation plan](./IMPLEMENTATION_PLAN.md)
- [Contributing + write a provider](./CONTRIBUTING.md)
- Examples: [`examples/`](./examples/)

## License

[Apache-2.0](./LICENSE). GeoWire's code license is separate from the terms of
third-party map/place data providers — usage of Google, Mapbox, HERE, Kakao,
Naver, etc. is governed by each provider's own terms. OSM data is under ODbL;
GeoWire's policy engine enforces attribution and caching limits per provider.
