import { describe, expect, it } from "vitest";
import { Place, PlaceSource } from "../src/index.js";

const validSource = {
  provider: "nominatim",
  providerPlaceId: "node/123456",
  fetchedAt: "2026-07-17T09:00:00Z",
};

const validPlace = {
  id: "gwp_abc123",
  name: "Pharmacity",
  categories: ["pharmacy"],
  location: { latitude: 10.78, longitude: 106.69 },
  sources: [validSource],
  attributions: ["© OpenStreetMap contributors"],
};

describe("Place", () => {
  it("accepts a minimal valid place", () => {
    const parsed = Place.parse(validPlace);
    expect(parsed.name).toBe("Pharmacity");
    expect(parsed.sources).toHaveLength(1);
  });

  it("accepts a fully populated place", () => {
    const parsed = Place.parse({
      ...validPlace,
      localizedNames: { vi: "Nhà thuốc Pharmacity", ko: "파마시티" },
      address: {
        formatted: "12 Nguyễn Huệ, Ho Chi Minh City, Vietnam",
        country: "VN",
        city: "Ho Chi Minh City",
      },
      contact: { phone: "+84 28 7300 0000", website: "https://www.pharmacity.vn" },
      business: {
        openingHours: "Mo-Su 00:00-24:00",
        rating: 4.2,
        reviewCount: 128,
        priceLevel: 1,
      },
      distanceMeters: 420,
      confidence: 0.93,
      sources: [
        { ...validSource, confidence: 0.9, fields: ["location", "name"] },
        {
          provider: "google",
          providerPlaceId: "ChIJxxx",
          fetchedAt: "2026-07-17T09:00:01Z",
          fields: ["business.openingHours", "business.rating"],
        },
      ],
      metadata: { chainBrand: "pharmacity" },
    });
    expect(parsed.sources).toHaveLength(2);
    expect(parsed.address?.country).toBe("VN");
  });

  it("rejects a place without sources", () => {
    expect(() => Place.parse({ ...validPlace, sources: [] })).toThrow();
  });

  it("rejects an id without the gwp_ prefix", () => {
    expect(() => Place.parse({ ...validPlace, id: "place_123" })).toThrow();
  });

  it("rejects out-of-range coordinates", () => {
    expect(() =>
      Place.parse({ ...validPlace, location: { latitude: 91, longitude: 0 } }),
    ).toThrow();
  });

  it("rejects an invalid country code length", () => {
    expect(() =>
      Place.parse({ ...validPlace, address: { country: "KOR" } }),
    ).toThrow();
  });
});

describe("PlaceSource", () => {
  it("requires an ISO datetime for fetchedAt", () => {
    expect(() =>
      PlaceSource.parse({ ...validSource, fetchedAt: "yesterday" }),
    ).toThrow();
  });
});
