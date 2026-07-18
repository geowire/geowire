import type { Place } from "@geowirehq/schema";
import { haversineMeters } from "../../geo.js";

/** 라틴 법인 접미사 — 단어 경계(\b) 기준으로 제거 ("co"가 "company"를 오탐하지 않도록) */
const LATIN_SUFFIXES = [
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "co",
  "corp",
  "corporation",
  "company",
  "gmbh",
  "srl",
  "sarl",
  "sa",
  "bv",
  "plc",
  "pte",
];

/** CJK 법인 접미사 — 단어 경계가 없으므로(\b는 ASCII 전용) 직접 매칭해 제거 */
const CJK_SUFFIXES = ["주식회사", "유한회사", "有限公司", "有限会社", "株式会社"];

const LATIN_SUFFIX_RE = new RegExp(`\\b(${LATIN_SUFFIXES.join("|")})\\b\\.?`, "giu");
const CJK_SUFFIX_RE = new RegExp(`(${CJK_SUFFIXES.join("|")})`, "gu");

/**
 * 이름을 비교용으로 정규화한다 (설계 §7.3):
 * 유니코드 NFKC → 소문자 → 법인 접미사 제거(라틴·CJK) → 구두점 제거 → 공백 정리.
 */
export function normalizeName(name: string): string {
  return name
    .normalize("NFKC")
    .toLowerCase()
    .replace(LATIN_SUFFIX_RE, " ")
    .replace(CJK_SUFFIX_RE, " ")
    .replace(/[.,''"“”·・\-_/()]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

/** Jaro 유사도 (0~1) */
function jaro(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const matchWindow = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);

  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = true;
      bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;

  return (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
}

/** Jaro-Winkler 유사도 (0~1). 공통 접두사에 가중(최대 4자, p=0.1) */
export function jaroWinkler(a: string, b: string): number {
  const j = jaro(a, b);
  if (j === 0) return 0;
  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  while (prefix < maxPrefix && a[prefix] === b[prefix]) prefix++;
  return j + prefix * 0.1 * (1 - j);
}

/** 전화번호에서 숫자만 추출 */
function phoneDigits(phone: string): string {
  return phone.replace(/\D/gu, "");
}

/** URL에서 호스트명(www. 제거) 추출. 실패 시 원문 소문자 */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./u, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

/** 좌표 거리 → 근접 신호(0~1): 25m 이내 1, 500m 이상 0, 사이는 선형 */
function distanceSignal(a: Place, b: Place): number {
  const d = haversineMeters(a.location, b.location);
  if (d <= 25) return 1;
  if (d >= 500) return 0;
  return 1 - (d - 25) / 475;
}

/** 쌍별 점수 가중치 (설계 §7.3): 좌표 35 / 이름 30 / 주소 20 / 전화 10 / 웹 5 */
export const PAIR_WEIGHTS = {
  location: 35,
  name: 30,
  address: 20,
  phone: 10,
  website: 5,
} as const;

/**
 * 두 Place가 동일 장소일 가능성 점수(0~1).
 * 각 신호에 가중치를 곱하고, **비교 가능한(양쪽에 값이 있는) 신호의 가중치로만 정규화**한다
 * — 주소·전화·웹이 없다고 점수가 부당하게 낮아지지 않도록.
 * 좌표·이름은 항상 존재하므로 최소 신호는 보장된다.
 */
export function pairScore(a: Place, b: Place): number {
  let weightedSum = 0;
  let activeWeight = 0;

  const add = (weight: number, signal: number): void => {
    weightedSum += weight * signal;
    activeWeight += weight;
  };

  add(PAIR_WEIGHTS.location, distanceSignal(a, b));
  add(PAIR_WEIGHTS.name, jaroWinkler(normalizeName(a.name), normalizeName(b.name)));

  if (a.address?.formatted && b.address?.formatted) {
    add(
      PAIR_WEIGHTS.address,
      jaroWinkler(a.address.formatted.toLowerCase(), b.address.formatted.toLowerCase()),
    );
  }
  if (a.contact?.phone && b.contact?.phone) {
    const pa = phoneDigits(a.contact.phone);
    const pb = phoneDigits(b.contact.phone);
    const match = pa.length >= 7 && pb.length >= 7 && (pa.endsWith(pb) || pb.endsWith(pa));
    add(PAIR_WEIGHTS.phone, match ? 1 : 0);
  }
  if (a.contact?.website && b.contact?.website) {
    add(PAIR_WEIGHTS.website, hostname(a.contact.website) === hostname(b.contact.website) ? 1 : 0);
  }

  return activeWeight === 0 ? 0 : weightedSum / activeWeight;
}
