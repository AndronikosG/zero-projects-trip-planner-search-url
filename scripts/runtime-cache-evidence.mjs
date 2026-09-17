import { QueryClient } from "@tanstack/react-query";
import { decodeSearchParams, encodeSearchParams, getSearchCacheKey } from "../lib/search-url.mjs";

const coldUrl =
  "/?ss=Naples&checkin=2024-13-45&checkout=2025-09-1&adults=abc&nflt=zz_unknown_code%3D7";
const rawQuery = coldUrl.split("?")[1] ?? "";
const normalized = decodeSearchParams(rawQuery);
const canonical = encodeSearchParams(normalized);
const key = getSearchCacheKey(normalized);

console.log("[COLD_URL_LOAD]");
console.log(`url: ${coldUrl}`);
console.log(`controls.destination: ${normalized.dest}`);
console.log(`controls.checkin: ${normalized.checkin}`);
console.log(`controls.checkout: ${normalized.checkout}`);
console.log(`controls.guests: ${normalized.guests}`);
console.log(`controls.rooms: ${normalized.rooms}`);
console.log(`controls.maxprice: ${normalized.maxprice ?? "no limit"}`);
console.log(`canonicalUrl: /?${canonical}`);
console.log(
  "fallbackRule: invalid checkin + valid checkout => checkin = checkout - 1 calendar day",
);

let endpointCalls = 0;
const client = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
    },
  },
});

async function queryFn() {
  endpointCalls += 1;
  return {
    heading: `Stays in ${normalized.dest}`,
    searchSummary: `${normalized.checkin} -> ${normalized.checkout} · ${normalized.guests} guests · ${normalized.rooms} room`,
    results: [
      "Naples Central Hotel",
      "Naples Garden Rooms",
      "Naples Riverside Stay",
    ],
  };
}

console.log("\n[RESULTS_AND_CACHE]");
console.log(`cacheKey: ${JSON.stringify(key)}`);

const first = await client.fetchQuery({
  queryKey: key,
  queryFn,
  staleTime: Infinity,
});
console.log(`after first fetch endpointCalls=${endpointCalls}`);
console.log(`renderedState: ${JSON.stringify(first)}`);

const second = await client.fetchQuery({
  queryKey: key,
  queryFn,
  staleTime: Infinity,
});
console.log(`after repeat fetch endpointCalls=${endpointCalls}`);
console.log(`repeatState: ${JSON.stringify(second)}`);

if (endpointCalls !== 1) {
  throw new Error(
    `Expected one queryFn call across identical repeat searches, got ${endpointCalls}`,
  );
}

console.log(
  "cacheVerdict: PASS - identical normalized repeat state reused the cached result",
);
