import assert from "node:assert/strict";
import test from "node:test";
import {
  decodeSearchParams,
  encodeSearchParams,
  getSearchCacheKey,
} from "../lib/search-url.mjs";

function printCase(name, input, parsed) {
  console.log(`\n[${name}]`);
  console.log(`input: ${input}`);
  console.log(`parsed: ${JSON.stringify(parsed)}`);
  console.log(`canonical: ${encodeSearchParams(parsed)}`);
  console.log(`cacheKey: ${JSON.stringify(getSearchCacheKey(parsed))}`);
}

function assertRoundTrip(state) {
  const encoded = encodeSearchParams(state);
  assert.deepEqual(decodeSearchParams(encoded), state);
}

test("SL-0107 clean values decode without modification", () => {
  const input =
    "dest=Amsterdam&checkin=2025-02-06&checkout=2025-02-09&guests=2&rooms=1";
  const parsed = decodeSearchParams(input);

  printCase("SL-0107 clean", input, parsed);

  assert.deepEqual(parsed, {
    dest: "Amsterdam",
    checkin: "2025-02-06",
    checkout: "2025-02-09",
    guests: 2,
    rooms: 1,
  });
  assertRoundTrip(parsed);
});

test("SL-0104 legacy names map into current schema fields", () => {
  const input =
    "dest=Barcelona&checkin_monthday=22&checkin_month=2&checkin_year=2025&adults=3&rooms=1&price_max=180&sortBy=review_score_desc";
  const parsed = decodeSearchParams(input);

  printCase("SL-0104 legacy names", input, parsed);

  assert.deepEqual(parsed, {
    dest: "Barcelona",
    checkin: "2025-02-22",
    checkout: "2025-02-23",
    guests: 3,
    rooms: 1,
    maxprice: 180,
  });
  assertRoundTrip(parsed);
});

test("SL-0128 missing search values use safe defaults", () => {
  const input = "aid=304142&label=gog235jc&utm_source=imessage";
  const parsed = decodeSearchParams(input);

  printCase("SL-0128 missing fields", input, parsed);

  assert.deepEqual(parsed, {
    dest: "anywhere",
    checkin: "2025-01-01",
    checkout: "2025-01-02",
    guests: 2,
    rooms: 1,
  });
  assertRoundTrip(parsed);
});

test("SL-0180 out-of-range price clamps to contract maximum", () => {
  const input =
    "ss=Palma&checkin=2025-06-14&checkout=2025-06-21&group_adults=4&no_rooms=2&maxPrice=9999999";
  const parsed = decodeSearchParams(input);

  printCase("SL-0180 clamped price", input, parsed);

  assert.deepEqual(parsed, {
    dest: "Palma",
    checkin: "2025-06-14",
    checkout: "2025-06-21",
    guests: 4,
    rooms: 2,
    maxprice: 1000,
  });
  assertRoundTrip(parsed);
});

test("SL-0142 invalid date recovers to a valid fallback date", () => {
  const input =
    "ss=Naples&checkin=2024-13-45&checkout=2025-09-1&adults=abc&nflt=zz_unknown_code%3D7";
  const parsed = decodeSearchParams(input);

  printCase("SL-0142 invalid date", input, parsed);

  assert.deepEqual(parsed, {
    dest: "Naples",
    checkin: "2025-08-31",
    checkout: "2025-09-01",
    guests: 2,
    rooms: 1,
  });
  assertRoundTrip(parsed);
});
