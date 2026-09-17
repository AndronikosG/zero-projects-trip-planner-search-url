import {
  DEFAULT_CHECKIN,
  DEFAULT_GUESTS,
  DEFAULT_ROOMS,
  SearchStateSchema,
} from "./search-schema.mjs";

const DEST_KEYS = ["dest", "ss", "city", "destination"];
const GUEST_KEYS = ["guests", "group_adults", "adults"];
const ROOM_KEYS = ["rooms", "no_rooms"];
const PRICE_KEYS = ["maxprice", "price_max", "maxPrice", "budget"];

function normalizeWhitespace(value) {
  return value.trim().replace(/\s+/g, " ");
}

function parseDate(value) {
  if (!value) return undefined;

  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
  if (!match) return undefined;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return undefined;
  }

  return [
    String(year).padStart(4, "0"),
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

function addDays(isoDate, amount) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + amount));

  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function readDestination(params) {
  for (const key of DEST_KEYS) {
    const raw = params.get(key);
    if (raw === null) continue;

    const value = normalizeWhitespace(raw);
    if (value.length >= 1 && value.length <= 100) {
      return value;
    }
  }

  return "anywhere";
}

function readInteger(params, keys, fallback, min, max) {
  for (const key of keys) {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") continue;

    if (!/^-?\d+$/.test(raw.trim())) continue;

    const value = Number(raw);
    if (!Number.isSafeInteger(value)) continue;

    return Math.min(max, Math.max(min, value));
  }

  return fallback;
}

function readPrice(params) {
  for (const key of PRICE_KEYS) {
    const raw = params.get(key);
    if (raw === null || raw.trim() === "") continue;

    if (!/^-?\d+$/.test(raw.trim())) continue;

    const value = Number(raw);
    if (!Number.isSafeInteger(value)) continue;

    return Math.min(1000, Math.max(1, value));
  }

  return undefined;
}

function readLegacyCheckin(params) {
  const dayRaw = params.get("checkin_monthday");
  const monthRaw = params.get("checkin_month");
  const yearRaw = params.get("checkin_year");

  if (!dayRaw || !monthRaw || !yearRaw) return undefined;
  if (!/^\d+$/.test(dayRaw) || !/^\d+$/.test(monthRaw) || !/^\d+$/.test(yearRaw)) {
    return undefined;
  }

  return parseDate(
    `${yearRaw}-${String(Number(monthRaw)).padStart(2, "0")}-${String(
      Number(dayRaw),
    ).padStart(2, "0")}`,
  );
}

export function decodeSearchParams(input) {
  const params =
    input instanceof URLSearchParams
      ? input
      : new URLSearchParams(String(input).replace(/^\?/, ""));

  const checkoutCandidate = parseDate(params.get("checkout"));
  const checkinCandidate =
    parseDate(params.get("checkin")) ??
    readLegacyCheckin(params) ??
    (checkoutCandidate ? addDays(checkoutCandidate, -1) : DEFAULT_CHECKIN);

  const checkout =
    checkoutCandidate && checkoutCandidate > checkinCandidate
      ? checkoutCandidate
      : addDays(checkinCandidate, 1);

  const maxprice = readPrice(params);
  const candidate = {
    dest: readDestination(params),
    checkin: checkinCandidate,
    checkout,
    guests: readInteger(params, GUEST_KEYS, DEFAULT_GUESTS, 1, 10),
    rooms: readInteger(params, ROOM_KEYS, DEFAULT_ROOMS, 1, 5),
    ...(maxprice === undefined ? {} : { maxprice }),
  };

  return SearchStateSchema.parse(candidate);
}

export function encodeSearchParams(state) {
  const normalized = SearchStateSchema.parse(state);
  const params = new URLSearchParams();

  params.set("dest", normalized.dest);
  params.set("checkin", normalized.checkin);
  params.set("checkout", normalized.checkout);
  params.set("guests", String(normalized.guests));
  params.set("rooms", String(normalized.rooms));

  if (normalized.maxprice !== undefined) {
    params.set("maxprice", String(normalized.maxprice));
  }

  return params.toString();
}

export function getSearchCacheKey(state) {
  const normalized = SearchStateSchema.parse(state);

  return [
    "accommodation-search",
    normalized.dest.toLowerCase(),
    normalized.checkin,
    normalized.checkout,
    normalized.guests,
    normalized.rooms,
    normalized.maxprice ?? null,
  ];
}
