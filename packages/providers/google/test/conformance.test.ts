import { describe, it, expect } from "vitest";
import { runConformanceTests, jsonFetch, statusFetch, createTestContext } from "@geowirehq/provider-testkit";
import { GeoProviderError } from "@geowirehq/provider-sdk";
import { createGoogleProvider } from "../src/index.js";

const searchBody = {
  places: [
    {
      id: "ChIJgangnam1",
      displayName: { text: "GS25 강남점", languageCode: "ko" },
      formattedAddress: "서울특별시 강남구 테헤란로 1",
      location: { latitude: 37.498, longitude: 127.028 },
      types: ["convenience_store", "store", "point_of_interest", "establishment"],
      rating: 4.2,
      userRatingCount: 130,
      nationalPhoneNumber: "02-555-1234",
      websiteUri: "https://gs25.example.com",
      priceLevel: "PRICE_LEVEL_INEXPENSIVE",
      regularOpeningHours: { weekdayDescriptions: ["월요일: 24시간 영업"] },
    },
  ],
};

const geocodeBody = {
  status: "OK",
  results: [
    {
      place_id: "ChIJseoulcityhall",
      formatted_address: "서울특별시청, 세종대로 110, 중구, 서울, 대한민국",
      geometry: { location: { lat: 37.5665, lng: 126.978 } },
      types: ["premise"],
      address_components: [
        { long_name: "서울특별시청", short_name: "서울특별시청", types: ["premise"] },
        { long_name: "중구", short_name: "중구", types: ["sublocality", "political"] },
        { long_name: "서울", short_name: "서울", types: ["locality", "political"] },
        { long_name: "대한민국", short_name: "KR", types: ["country", "political"] },
      ],
    },
  ],
};

const detailsBody = searchBody.places[0];

const provider = createGoogleProvider({ apiKey: "test-key" });

runConformanceTests(provider, {
  fixtures: {
    search: {
      request: { query: "GS25 near Gangnam", limit: 5 },
      responseBody: searchBody,
      minResults: 1,
    },
    geocode: {
      request: { address: "서울특별시청", country: "KR", limit: 5 },
      responseBody: geocodeBody,
      minResults: 1,
    },
    reverseGeocode: {
      request: { location: { latitude: 37.5665, longitude: 126.978 } },
      responseBody: geocodeBody,
      minResults: 1,
    },
    getPlace: {
      request: { id: "ChIJgangnam1" },
      responseBody: detailsBody,
      minResults: 1,
    },
  },
});

describe("createGoogleProvider — BYOK", () => {
  it("키가 없으면 MISSING_CREDENTIALS를 던진다", async () => {
    const noKey = createGoogleProvider({});
    const ctx = createTestContext(jsonFetch(searchBody));
    await expect(noKey.searchPlaces!({ query: "x", limit: 10 }, ctx)).rejects.toMatchObject({
      code: "MISSING_CREDENTIALS",
    });
  });

  it("Places 응답을 정규화하고 카테고리·연락처·평점을 매핑한다", async () => {
    const ctx = createTestContext(jsonFetch(searchBody));
    const places = await provider.searchPlaces!({ query: "GS25", limit: 10 }, ctx);
    expect(places).toHaveLength(1);
    expect(places[0]!.providerPlaceId).toBe("ChIJgangnam1");
    expect(places[0]!.categories).toContain("convenience");
    expect(places[0]!.categories).not.toContain("establishment"); // 일반 type 제외
    expect(places[0]!.contact?.phone).toBe("02-555-1234");
    expect(places[0]!.business?.rating).toBe(4.2);
    expect(places[0]!.business?.priceLevel).toBe(1);
    expect(places[0]!.localizedNames).toEqual({ ko: "GS25 강남점" });
  });

  it("Geocoding status가 REQUEST_DENIED면 AUTH_FAILED로 정규화한다", async () => {
    const ctx = createTestContext(jsonFetch({ status: "REQUEST_DENIED", results: [] }));
    await expect(
      provider.geocode!({ address: "x", limit: 5 }, ctx),
    ).rejects.toMatchObject({ code: "AUTH_FAILED" });
  });

  it("Geocoding status가 ZERO_RESULTS면 빈 배열 (에러 아님)", async () => {
    const ctx = createTestContext(jsonFetch({ status: "ZERO_RESULTS", results: [] }));
    const out = await provider.geocode!({ address: "없는주소", limit: 5 }, ctx);
    expect(out).toEqual([]);
  });

  it("getPlace는 단일 place를 반환한다", async () => {
    const ctx = createTestContext(jsonFetch(detailsBody));
    const place = await provider.getPlace!({ id: "ChIJgangnam1" }, ctx);
    expect(place?.providerPlaceId).toBe("ChIJgangnam1");
  });

  it("HTTP 403은 AUTH_FAILED로 정규화한다", async () => {
    const ctx = createTestContext(statusFetch(403), { retries: 0 });
    await expect(
      provider.searchPlaces!({ query: "x", limit: 10 }, ctx),
    ).rejects.toBeInstanceOf(GeoProviderError);
  });
});
