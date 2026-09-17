import { QueryClient } from "@tanstack/react-query";
import { decodeSearchParams, getSearchCacheKey } from "../lib/search-url.mjs";

const input =
  "ss=Naples&checkin=2024-13-45&checkout=2025-09-1&adults=abc&nflt=zz_unknown_code%3D7";
const normalized = decodeSearchParams(input);
const key = getSearchCacheKey(normalized);

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
    normalized,
    results: ["Naples Central Hotel", "Naples Garden Rooms", "Naples Riverside Stay"],
  };
}

console.log("[CACHE_RUNTIME]");
console.log(`input: ${input}`);
console.log(`normalized: ${JSON.stringify(normalized)}`);
console.log(`cacheKey: ${JSON.stringify(key)}`);

const first = await client.fetchQuery({ queryKey: key, queryFn, staleTime: Infinity });
console.log(`after first fetch endpointCalls=${endpointCalls}`);
console.log(`firstResult: ${JSON.stringify(first)}`);

const second = await client.fetchQuery({ queryKey: key, queryFn, staleTime: Infinity });
console.log(`after repeat fetch endpointCalls=${endpointCalls}`);
console.log(`secondResult: ${JSON.stringify(second)}`);

if (endpointCalls !== 1) {
  throw new Error(`Expected one endpoint call across repeat fetches, got ${endpointCalls}`);
}

console.log("cache verdict: PASS - repeat normalized search was served without a second queryFn call");
