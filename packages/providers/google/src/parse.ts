import { CountryCode } from "@geowirehq/schema";
import type { Address, Business, Contact } from "@geowirehq/schema";
import type { ProviderPlace } from "@geowirehq/provider-sdk";
import { mapGoogleTypes } from "./category-map.js";

/** Places API (New) place 리소스의 관심 필드 (전부 선택적, 방어적 파싱) */
export interface GooglePlace {
  id?: string;
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  types?: string[];
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  regularOpeningHours?: { weekdayDescriptions?: string[] };
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  priceLevel?: string;
}

const PRICE_LEVEL: Record<string, number> = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

/** Places API (New) place → ProviderPlace. 좌표·id 없으면 null */
export function parseGooglePlace(raw: GooglePlace): ProviderPlace | null {
  const latitude = raw.location?.latitude;
  const longitude = raw.location?.longitude;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;
  if (!raw.id) return null;

  const name = raw.displayName?.text?.trim();
  const place: ProviderPlace = {
    providerPlaceId: raw.id,
    name: name && name.length > 0 ? name : (raw.formattedAddress ?? "Unknown"),
    categories: mapGoogleTypes(raw.types ?? (raw.primaryType ? [raw.primaryType] : [])),
    location: { latitude, longitude },
  };

  const lang = raw.displayName?.languageCode;
  if (name && lang) place.localizedNames = { [lang]: name };

  if (raw.formattedAddress) place.address = { formatted: raw.formattedAddress };

  const contact: Contact = {};
  const phone = raw.nationalPhoneNumber ?? raw.internationalPhoneNumber;
  if (phone) contact.phone = phone;
  if (raw.websiteUri) contact.website = raw.websiteUri;
  if (Object.keys(contact).length > 0) place.contact = contact;

  const business: Business = {};
  if (typeof raw.rating === "number") business.rating = clampRating(raw.rating);
  if (typeof raw.userRatingCount === "number") business.reviewCount = raw.userRatingCount;
  if (raw.priceLevel && raw.priceLevel in PRICE_LEVEL) business.priceLevel = PRICE_LEVEL[raw.priceLevel];
  // Google 영업시간은 사람이 읽는 문장(weekdayDescriptions)이라 OSM opening_hours 포맷과 다르다.
  // 손실 없는 변환이 불가하므로 business.openingHours는 채우지 않고 metadata로 보존한다(v0.2 파서 도입 전).
  if (Object.keys(business).length > 0) place.business = business;

  if (raw.regularOpeningHours?.weekdayDescriptions?.length) {
    place.metadata = { googleWeekdayDescriptions: raw.regularOpeningHours.weekdayDescriptions };
  }

  return place;
}

/** 여러 place → ProviderPlace[] */
export function parseGooglePlaces(places: readonly GooglePlace[] | undefined): ProviderPlace[] {
  const out: ProviderPlace[] = [];
  for (const raw of places ?? []) {
    const place = parseGooglePlace(raw);
    if (place) out.push(place);
  }
  return out;
}

/** Geocoding API result의 관심 필드 */
export interface GeocodeResult {
  place_id?: string;
  formatted_address?: string;
  geometry?: { location?: { lat?: number; lng?: number } };
  types?: string[];
  address_components?: Array<{ long_name?: string; short_name?: string; types?: string[] }>;
}

/** Geocoding API result → ProviderPlace. 좌표·place_id 없으면 null */
export function parseGeocodeResult(raw: GeocodeResult): ProviderPlace | null {
  const lat = raw.geometry?.location?.lat;
  const lng = raw.geometry?.location?.lng;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  if (!raw.place_id) return null;

  const place: ProviderPlace = {
    providerPlaceId: raw.place_id,
    name: pickGeocodeName(raw),
    categories: mapGoogleTypes(raw.types),
    location: { latitude: lat, longitude: lng },
  };

  const address = parseGeocodeAddress(raw);
  if (address) place.address = address;
  return place;
}

export function parseGeocodeResults(results: readonly GeocodeResult[] | undefined): ProviderPlace[] {
  const out: ProviderPlace[] = [];
  for (const raw of results ?? []) {
    const place = parseGeocodeResult(raw);
    if (place) out.push(place);
  }
  return out;
}

function pickGeocodeName(raw: GeocodeResult): string {
  const first = raw.address_components?.[0]?.long_name?.trim();
  if (first) return first;
  const seg = raw.formatted_address?.split(",")[0]?.trim();
  if (seg) return seg;
  return raw.formatted_address?.trim() || "Unknown";
}

function parseGeocodeAddress(raw: GeocodeResult): Address | undefined {
  const address: Address = {};
  if (raw.formatted_address) address.formatted = raw.formatted_address;
  for (const c of raw.address_components ?? []) {
    const types = c.types ?? [];
    if (types.includes("country") && c.short_name) {
      const cc = CountryCode.safeParse(c.short_name);
      if (cc.success) address.country = cc.data;
    } else if (types.includes("administrative_area_level_1") && c.long_name) {
      address.region = c.long_name;
    } else if (types.includes("locality") && c.long_name) {
      address.city = c.long_name;
    } else if (types.includes("sublocality") && c.long_name) {
      address.district = c.long_name;
    } else if (types.includes("route") && c.long_name) {
      address.street = c.long_name;
    } else if (types.includes("postal_code") && c.long_name) {
      address.postalCode = c.long_name;
    }
  }
  return Object.keys(address).length > 0 ? address : undefined;
}

function clampRating(value: number): number {
  return Math.max(0, Math.min(5, value));
}
