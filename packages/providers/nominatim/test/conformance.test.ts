import { describe, expect, it } from "vitest";
import { runConformanceTests, jsonFetch, createTestContext } from "@geowire/provider-testkit";
import { createNominatimProvider } from "../src/index.js";

const searchBody = [
  {
    osm_type: "node",
    osm_id: 123,
    place_id: 1,
    lat: "10.7769",
    lon: "106.7009",
    name: "Pharmacity",
    display_name: "Pharmacity, Nguyễn Huệ, Bến Nghé, Quận 1, Hồ Chí Minh, Việt Nam",
    category: "amenity",
    type: "pharmacy",
    importance: 0.35,
    addresstype: "amenity",
    address: {
      road: "Nguyễn Huệ",
      city: "Hồ Chí Minh",
      country_code: "vn",
      postcode: "70000",
    },
  },
];

const koreaGeocode = [
  {
    osm_type: "way",
    osm_id: 42,
    lat: "37.5665",
    lon: "126.978",
    name: "서울특별시청",
    display_name: "서울특별시청, 세종대로, 중구, 서울, 대한민국",
    category: "office",
    type: "government",
    importance: 0.6,
    address: { road: "세종대로", city: "서울", country_code: "kr" },
  },
];

const reverseBody = {
  osm_type: "way",
  osm_id: 99,
  lat: "37.5665",
  lon: "126.978",
  name: "",
  display_name: "중구, 서울, 대한민국",
  category: "boundary",
  type: "administrative",
  address: { city: "서울", country_code: "kr" },
};

// 테스트에서는 rate limit 대기를 no-op으로 (공용 서버 예절은 rate-limit.test.ts에서 검증)
const provider = createNominatimProvider({ sleep: async () => {} });

runConformanceTests(provider, {
  fixtures: {
    search: {
      request: { query: "pharmacy near Nguyễn Huệ", limit: 5 },
      responseBody: searchBody,
      minResults: 1,
    },
    geocode: {
      request: { address: "서울특별시청", country: "KR", limit: 5 },
      responseBody: koreaGeocode,
      minResults: 1,
    },
    reverseGeocode: {
      request: { location: { latitude: 37.5665, longitude: 126.978 } },
      responseBody: reverseBody,
      minResults: 1,
    },
  },
});

describe("createNominatimProvider", () => {
  it("parses a live-shaped search response through the retrying fetch", async () => {
    const ctx = createTestContext(jsonFetch(searchBody));
    const places = await provider.searchPlaces!(
      { query: "pharmacy", limit: 10 },
      ctx,
    );
    expect(places).toHaveLength(1);
    expect(places[0]?.providerPlaceId).toBe("node/123");
    expect(places[0]?.address?.country).toBe("VN");
  });

  it("handles a single-object reverse response", async () => {
    const ctx = createTestContext(jsonFetch(reverseBody));
    const places = await provider.reverseGeocode!(
      { location: { latitude: 37.5665, longitude: 126.978 } },
      ctx,
    );
    expect(places).toHaveLength(1);
    expect(places[0]?.name).toBe("중구");
  });
});
